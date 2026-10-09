import path from 'path'
import {
  BASE_URL, API_KEY, FRONTEND_BASE,
  STAGE_R1, POST_SURVEY_STAGE_ID, EXPERIMENT_DEFAULT,
  PRE_SURVEY_STAGE_ID,
} from './config'
import { parseMediatorTemplate, buildMediator } from './parsers/mediator'
import { buildAgent } from './parsers/agent'
import type { AgentParticipantTemplate } from './parsers/agent'
import { parseAssistantTemplate, buildAssistant } from './parsers/assistant'
import type { AgentAssistantTemplate } from './parsers/assistant'
import { buildTopic, buildStages, buildExperiment, type CohortFlags } from './parsers/experiment'
import { loadTemplate, replaceDefaults, fillAgentStance, agentConfig, createParticipant, excludeNone } from './utils'

export type Mode = 'human-human' | 'human-agent' | 'agent-agent'
type ParticipantSlot = { slot: string; type: 'human' | 'agent'; template?: string }

const randint = (a: number, b: number) => Math.floor(Math.random() * (b - a + 1)) + a

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = arr[i]
    arr[i] = arr[j]
    arr[j] = tmp
  }
  return arr
}

// The toolkit picks the mode via the request/button, so we build the participant
// slots from `mode`. The agent template path is data here (mirrors the `participants`
// block generator.py reads from YAML: `template: templates/defaults/agent-N.yaml`),
// resolved like the topic experiment.yaml path below. Reddit-toolkit requests use the
// reddit-specific agent templates instead, which reference {post_title}/{post_description}.
const agentTemplate = (file: string, templateSet?: 'reddit' | 'wikipedia') =>
  path.join(process.cwd(), 'public', 'templates', templateSet === 'reddit' || templateSet === 'wikipedia' ? templateSet : 'defaults', file)

const AGENT_TEMPLATE_FILES = ['agent-1.yaml', 'agent-2.yaml']

// The seats each mode stands for, in the order they are handed to p1, p2.
function participantSlotsFor(mode: Mode, templateSet?: 'reddit' | 'wikipedia'): ParticipantSlot[] {
  const seats: ('human' | 'agent')[] = mode === 'agent-agent' ? ['agent', 'agent']
    : mode === 'human-agent' ? ['human', 'agent']
    : ['human', 'human']
  let agentIndex = 0
  return seats.map((type, i) => {
    const slot = `p${i + 1}`
    if (type === 'human') return { slot, type: 'human' as const }
    return { slot, type: 'agent' as const, template: agentTemplate(AGENT_TEMPLATE_FILES[agentIndex++], templateSet) }
  })
}

// Mediator randomization within each cohort
const BIAS_VARIABLE_CONFIG = {
  id: 'bias-target',
  type: 'random_permutation',
  scope: 'cohort',
  definition: {
    name: 'target_bias_position',
    description: 'Which side the mediator favors (randomized per cohort)',
    schema: { type: 'array', items: { type: 'string' } },
  },
  shuffleConfig: { shuffle: true, seed: 'cohort', customSeed: '' },
  values: [JSON.stringify('supporting the debate statement'), JSON.stringify('opposing the debate statement')],
  expandListToSeparateVariables: false,
  numToSelect: 1,
}

export async function generate(p1: string, p2: string, experimentTemplatePath: string, mediatorTemplateContent: string | null | undefined,
                          mode: Mode, numCohorts?: number, numUtterances?: number, action?: 'create' | 'simulate',
                          assistantTemplateContent?: string,
                          postTitle?: string, postDescription?: string,
                          agentAssignment?: 'participant-1' | 'participant-2' | 'both', templateSet?: 'reddit' | 'wikipedia',
                          opParticipant?: 'participant-1' | 'participant-2',
                          // Experiment-wide chat settings from the request.
                          requestFlags: CohortFlags = {},
                          // The template the experiment template is layered over, e.g. to swap in a different survey.
                          baseTemplatePath: string = EXPERIMENT_DEFAULT) {
  const experimentTemplate = replaceDefaults(
    loadTemplate(experimentTemplatePath),
    loadTemplate(baseTemplatePath),
  )
  const topicInfo = buildTopic(experimentTemplate.topic)

  const stages = buildStages(experimentTemplate, topicInfo, postTitle, postDescription)
  const stageIdsInOrder = stages.map((s) => s.id)

  // one mediator + one chat supported for now
  const chatStageId = stages.find((s) => s.kind === 'chat')?.id ?? STAGE_R1
  const preSurveyStageId = stages.find((s) => s.kind === 'survey' && s.id === PRE_SURVEY_STAGE_ID)?.id
    ?? PRE_SURVEY_STAGE_ID
  const postSurveyStageId = [...stages].reverse().find((s) => s.kind === 'survey')?.id
    ?? POST_SURVEY_STAGE_ID

  // Only mediator-toolkit runs have a mediator; the assistant toolkits' runs are
  // created with an empty `agentMediators` list.
  const mediatorR1 = mediatorTemplateContent
    ? buildMediator(chatStageId, parseMediatorTemplate(mediatorTemplateContent), stageIdsInOrder, topicInfo)
    : null

  const roleFor = (slot: string): 'OP' | 'Challenger' | undefined =>
    opParticipant ? ((slot === 'p1' && opParticipant === 'participant-1') || (slot === 'p2' && opParticipant === 'participant-2') ? 'OP' : 'Challenger') : undefined

  const exp = experimentTemplate.experiment ?? {}
  const participantSlots = participantSlotsFor(mode, templateSet)
  const slotToPid: Record<string, string> = { p1, p2 }

  const agentSlots = participantSlots.filter((s) => s.type === 'agent').map((s) => s.slot)

  // An all-agent run needs nobody to show up, so it can be batched into cohorts
  // and held to a wall-clock limit.
  const isSim = mode === 'agent-agent'

  // Agents in an all-agent debate are drawn onto opposing sides of the debate
  // statement, which is what makes it worth watching.
  const opposeStances = isSim

  // Assistants are addressed by the slot they stand behind, so they are built
  // once the seats are laid out. They are experiment-wide rather than per-cohort:
  // `agentAssistants` holds one definition each, which every cohort's agents then
  // point at through `persona.assistantId`.
  const assistants: AgentAssistantTemplate[] = []
  const assistantIdForSlot: Record<string, string> = {}
  if (assistantTemplateContent) {
    // one shared assistant normally; but when both participants get the assistant and we know
    // who's OP, build two role-specific assistants (one can't correctly serve both roles at once).
    const parsedAssistant = parseAssistantTemplate(assistantTemplateContent)
    if (agentAssignment === 'both' && opParticipant) {
      const opSlot = opParticipant === 'participant-1' ? 'p1' : 'p2'
      const challengerSlot = opSlot === 'p1' ? 'p2' : 'p1'
      const opAssistant = buildAssistant(chatStageId, parsedAssistant, stageIdsInOrder, topicInfo, postTitle, postDescription, 'OP')
      opAssistant.persona.id = `${opAssistant.persona.id}-op`
      const challengerAssistant = buildAssistant(chatStageId, parsedAssistant, stageIdsInOrder, topicInfo, postTitle, postDescription, 'Challenger')
      challengerAssistant.persona.id = `${challengerAssistant.persona.id}-challenger`
      assistants.push(opAssistant, challengerAssistant)
      assistantIdForSlot[opSlot] = opAssistant.persona.id
      assistantIdForSlot[challengerSlot] = challengerAssistant.persona.id
    } else {
      const singleSlot = agentAssignment === 'participant-1' ? 'p1' : agentAssignment === 'participant-2' ? 'p2' : undefined
      const assistant = buildAssistant(chatStageId, parsedAssistant, stageIdsInOrder, topicInfo, postTitle, postDescription, singleSlot ? roleFor(singleSlot) : undefined)
      assistants.push(assistant)
      if (singleSlot) {
        assistantIdForSlot[singleSlot] = assistant.persona.id
      } else {
        assistantIdForSlot.p1 = assistant.persona.id
        assistantIdForSlot.p2 = assistant.persona.id
      }
    }
  }

  const chatStage = stages.find((s) => s.kind === 'chat')
  if (chatStage) {
    if (isSim) {
      // currently not removing the timer limit, in case simulation gets stuck in some cohorts, they can still finish within this time.
      chatStage.timeLimitInMinutes = 9
      chatStage.requireFullTime = false
      if (numUtterances != null) chatStage.numUtterances = numUtterances  // else keep template default
    } else {
      chatStage.numUtterances = null
    }
    // The chat cannot start until every slot in the run has arrived.
    if (chatStage.progress) chatStage.progress.minParticipants = participantSlots.length

    if (assistants.length > 0 && chatStage.progress) {
      const isHumanSlot = (slot: string) => participantSlots.find((s) => s.slot === slot)?.type === 'human'
      const mapping: Record<string, string> = {}
      if ((agentAssignment === 'participant-1' || agentAssignment === 'both') && isHumanSlot('p1') && assistantIdForSlot.p1) mapping[p1] = assistantIdForSlot.p1
      if ((agentAssignment === 'participant-2' || agentAssignment === 'both') && isHumanSlot('p2') && assistantIdForSlot.p2) mapping[p2] = assistantIdForSlot.p2
      chatStage.progress.pIdToAssistantId = mapping
    }
  }

  const numCohortsResolved = (isSim && action === 'simulate')
    ? (numCohorts && numCohorts >= 1 ? numCohorts : (Number(exp.num_cohorts) || 1))
    : 1

  // each cohort gets a randomized pair
  const cohortAgents: AgentParticipantTemplate[][] = []
  const agentStances: Record<string, any>[] = []
  const humanSlots: Record<string, string> = {}
  const cohortAgentConfigs: string[][] = []

  for (let ci = 0; ci < numCohortsResolved; ci++) {
    // Simulations want a real disagreement, so stances alternate strong-for /
    // strong-against before being shuffled across the slots.
    const ratings = opposeStances
      ? shuffle(agentSlots.map((_, i) => (i % 2 === 0 ? randint(5, 7) : randint(1, 3))))
      : agentSlots.map(() => randint(1, 7))
    const stance: Record<string, any> = {}
    agentSlots.forEach((slot, i) => {
      stance[slot] = { rating: ratings[i], }
    })

    const pair: AgentParticipantTemplate[] = []
    const configs: string[] = []

    for (const pSlot of participantSlots) {
      const slot = pSlot.slot
      if (pSlot.type === 'agent') {
        const tpl = loadTemplate(pSlot.template!)
        if (isSim) tpl.persona.id = `${tpl.persona.id}-${slot}-c${ci}`

        const wantsAssistant = agentAssignment === 'both'
          || (agentAssignment === 'participant-1' && slot === 'p1')
          || (agentAssignment === 'participant-2' && slot === 'p2')
        if (wantsAssistant && assistantIdForSlot[slot]) {
          tpl.persona.assistant_id = assistantIdForSlot[slot]
        }

        const redditRole = roleFor(slot)

        const s = stance[slot]
        const [filled, finalStance] = fillAgentStance(tpl, topicInfo, s.rating, s.rating, postTitle, postDescription, redditRole)
        stance[slot] = { side: finalStance.side, strength: finalStance.strength } // removing rating and concession info

        configs.push(filled.agent_config ?? '')
        const built = buildAgent(chatStageId, preSurveyStageId, postSurveyStageId, filled, stageIdsInOrder)
        pair.push(built)

      } else {
        humanSlots[slot] = slotToPid[slot]
      }
    }
    cohortAgents.push(pair)
    agentStances.push(stance)
    cohortAgentConfigs.push(configs)
  }

  const agents = cohortAgents.flat() 

  // Experiment-wide chat settings (assistant replies public, anyone may delete
  // a message): the request's, else the experiment YAML's.
  const [template, cohortAlias] = buildExperiment(experimentTemplate, topicInfo, stages, stageIdsInOrder, mediatorR1, agents, mode, isSim, assistants, postTitle, postDescription, participantSlots.length, requestFlags)
  // Nothing to randomize a bias for when the run has no mediator.
  template.experiment.variableConfigs = mediatorR1 ? [BIAS_VARIABLE_CONFIG] : []

  // A cohort holds exactly the run's participants, however many that is.
  template.experiment.defaultCohortConfig.minParticipantsPerCohort = participantSlots.length
  template.experiment.defaultCohortConfig.maxParticipantsPerCohort = participantSlots.length

  const authHeaders = {
    Authorization: `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
  }

  let expId: string
  let cohortIds: string[]
  let cohortBias: (Record<string, string> | null)[] = []

  if (isSim) {
    const cfg = exp.defaultCohortConfig ?? {}
    const expRes = await fetch(`${BASE_URL}/experiments`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ template: excludeNone(template) }),
    })
    if (!expRes.ok) throw new Error(`create_simulation failed: ${await expRes.text()}`)
    const expJson = await expRes.json()
    expId = expJson.experiment.id

    const cohortRes = await fetch(`${BASE_URL}/experiments/${expId}/cohorts/batch`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        cohorts: Array.from({ length: numCohortsResolved }, (_, i) => ({
          name: `[toolkit-sim] ${topicInfo.name} #${i + 1}`,
          description: `Simulation for ${topicInfo.name}.`,
          participantConfig: {
            minParticipantsPerCohort: participantSlots.length,
            maxParticipantsPerCohort: participantSlots.length,
            includeAllParticipantsInCohortCount: cfg.includeAllParticipantsInCohortCount ?? true,
            botProtection: cfg.botProtection ?? false,
          },
        })),
      }),
    })
    if (!cohortRes.ok) throw new Error(`create_simulation failed: ${await cohortRes.text()}`)
    const cohortJson = await cohortRes.json()
    cohortIds = cohortJson.cohorts.map((c: any) => (c.cohort ?? c).id)
    cohortBias = cohortJson.cohorts.map((c: any) => (c.cohort ?? c).variableMap ?? null)
  } else {
    const expRes = await fetch(`${BASE_URL}/experiments`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ template: excludeNone(template) }),
    })

    if (!expRes.ok) throw new Error(`create_experiment failed: ${await expRes.text()}`)
    const result = await expRes.json()
    expId = result.experiment.id

    const exportRes = await fetch(`${BASE_URL}/experiments/${expId}/export`, { method: 'GET', headers: authHeaders })
    if (!exportRes.ok) throw new Error(`export_experiment failed: ${await exportRes.text()}`)
    const expData = await exportRes.json()
    const generated: Record<string, string> = {}
    for (const c of expData.experiment.cohortDefinitions) generated[c.alias] = c.generatedCohortId
    cohortIds = [generated[cohortAlias]]

    const cohortRes = await fetch(`${BASE_URL}/experiments/${expId}/cohorts/${cohortIds[0]}`, { method: 'GET', headers: authHeaders })
    if (cohortRes.ok) {
      const cohortJson = await cohortRes.json()
      cohortBias = [(cohortJson.cohort ?? cohortJson)?.variableMap ?? null]
    }
  }

  const agentUrls: Record<string, string>[] = []

  for (let i = 0; i < cohortIds.length; i++) {
    const urls: Record<string, string> = {}
    for (let k = 0; k < cohortAgents[i].length; k++) {
      const created = await createParticipant(expId, cohortIds[i], agentConfig(cohortAgents[i][k], cohortAgentConfigs[i][k]))
      urls[agentSlots[k]] = `${FRONTEND_BASE}/#/e/${expId}/p/${created.id}`
    }
    agentUrls.push(urls)
  }

  const experimentUrl = `${FRONTEND_BASE}/#/e/${expId}`

  const biasFor = (i: number) => {
    // Absent whenever the run has no mediator to be biased in the first place.
    const raw = cohortBias[i]?.target_bias_position
    if (!raw) return null
    const parse = (s: string) => { try { return JSON.parse(s) } catch { return s } }
    const parsed = parse(raw)
    return { side: Array.isArray(parsed) ? parsed[0] : parsed }
  }

  const cohorts = cohortIds.map((cid, i) => {
    const cohortUrl = `${FRONTEND_BASE}/#/e/${expId}/c/${cid}`
    // Stances only ever describe the agents, so a run without any leaves them out.
    const stances = { ...(agentSlots.length > 0 ? { agent_stances: agentStances[i] } : {}), mediator_bias: biasFor(i) }

    // A batch simulation runs itself with nobody watching, so it reports the
    // cohort (and any stances) and hides the links.
    if (action === 'simulate') {
      return { cohort_id: cid, ...stances }
    }

    // One entry per seat, in order: a human joins through the cohort link under
    // their own id, while an agent already exists as a participant and is
    // watched through its own link.
    const participant_urls = participantSlots.map(({ slot, type }) => {
      const role = roleFor(slot)
      const url = type === 'human'
        ? `${cohortUrl}?PROLIFIC_PID=${humanSlots[slot]}`
        : agentUrls[i][slot]
      return { url, type, ...(role ? { role } : {}) }
    })

    return { cohort_id: cid, participant_urls, ...stances }
  })

  return {
    mode,
    topic: topicInfo.name,
    experiment_id: expId,
    // experiment_url: experimentUrl,
    cohorts,
    // is_sim: (mode === 'agent-agent' && action === 'simulate'),
  }
}
