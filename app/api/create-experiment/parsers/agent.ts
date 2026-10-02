import {
  buildPromptItems,
  buildPersona,
  buildGeneration,
  buildChatSettings,
  buildStructuredOutput,
  type PromptItem,
  type StructuredOutputConfig,
  type GenerationConfig,
  type ChatSettings,
  type Persona,
} from './common'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChatPromptConfig {
  id: string
  type: 'chat'
  includeScaffoldingInPrompt: boolean
  concedeStrength: number
  shouldConcedePrompt: PromptItem[]
  thoughtPrompt: PromptItem[]
  prompt: PromptItem[]
  shouldRespondPrompt: PromptItem[] | null
  minParticipantMessagesBeforeResponding: number
  structuredOutputConfig: StructuredOutputConfig
  generationConfig: GenerationConfig
  chatSettings: ChatSettings
  numRetries: number
  includePersona: string[] | null
  includeThoughtHistory: string[] | null
}

type GenericPromptConfig = {
  id: string
  type: 'survey'
  includeScaffoldingInPrompt: boolean
  includeConcessionInPrompt: boolean
  prompt: PromptItem[]
  generationConfig: GenerationConfig
  numRetries: number
  includePersona: string[] | null
  includeThoughtHistory: string[] | null
}

export interface AgentParticipantTemplate {
  persona: Persona
  promptMap: Record<string, ChatPromptConfig | GenericPromptConfig>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _shouldConcedePrompt(tpl: Record<string, any>, stage_id: string): PromptItem[] {
  return [
    {type: 'TEXT', text: tpl.should_concede_prompt },
    {
      type: 'STAGE_CONTEXT',
      stageId: stage_id,
      includePrimaryText: false,
      includeInfoText: false,
      includeHelpText: false,
      includeStageDisplay: true,
      includeParticipantAnswers: false,
    },
  ]
}

function _thoughtPrompt(tpl: Record<string, any>, stage_id: string): PromptItem[] {
  return [
    { type: 'TEXT', text: tpl.thought_prompt },
    {
      type: 'STAGE_CONTEXT',
      stageId: stage_id,
      includePrimaryText: false,
      includeInfoText: false,
      includeHelpText: false,
      includeStageDisplay: true,
      includeParticipantAnswers: false,
    },
  ]
}

function _human_style_prompt(tpl: Record<string, any>): PromptItem[] {
  return [{ type: 'TEXT', text: tpl.human_style_prompt }]
}

function _pre_survey_prompt(tpl: Record<string, any>): PromptItem[] {
  return [{ type: 'TEXT', text: tpl.pre_survey_prompt ?? '' }]
}

function _post_survey_prompt(tpl: Record<string, any>): PromptItem[] {
  return [{ type: 'TEXT', text: tpl.post_survey_prompt ?? '' }]
}


function _chatPrompt(tpl: Record<string, any>, stageId: string, stageIdsInOrder: string[]): ChatPromptConfig {
  return {
    id: stageId,
    type: 'chat',
    includeScaffoldingInPrompt: tpl.include_scaffolding_in_prompt,
    concedeStrength: tpl.concede_strength,
    shouldConcedePrompt: _shouldConcedePrompt(tpl, stageId),
    thoughtPrompt: _thoughtPrompt(tpl, stageId),
    prompt: buildPromptItems(tpl, stageId, stageIdsInOrder, _human_style_prompt(tpl)),
    shouldRespondPrompt: null,
    minParticipantMessagesBeforeResponding: tpl.min_participant_messages_before_responding,
    structuredOutputConfig: buildStructuredOutput(tpl),
    generationConfig: buildGeneration(tpl, "chat_generation"),
    chatSettings: buildChatSettings(tpl),
    numRetries: tpl.num_retries,
    includePersona: [stageId],
    includeThoughtHistory: [stageId],
  }
}

function _pre_survey_stage(tpl: Record<string, any>, stageId: string, stageIdsInOrder: string[]): GenericPromptConfig {
  return {
    id: stageId,
    type: 'survey',
    includeScaffoldingInPrompt: true,
    includeConcessionInPrompt: true,
    prompt: buildPromptItems(tpl, stageId, stageIdsInOrder, _pre_survey_prompt(tpl)),
    generationConfig: buildGeneration(tpl, "pre_survey_generation"),
    numRetries: tpl.num_retries,
    includePersona: null,
    includeThoughtHistory: null,
  }
}

function _post_survey_stage(tpl: Record<string, any>, stageId: string, stageIdsInOrder: string[], personaStages: string[], thoughtHistoryStages: string[]): GenericPromptConfig {
  return {
    id: stageId,
    type: 'survey',
    includeScaffoldingInPrompt: true,
    includeConcessionInPrompt: true,
    prompt: buildPromptItems(tpl, stageId, stageIdsInOrder, _post_survey_prompt(tpl)),
    generationConfig: buildGeneration(tpl, "post_survey_generation"),
    numRetries: tpl.num_retries,
    includePersona: personaStages,
    includeThoughtHistory: thoughtHistoryStages,
  }
}



// ── Public ────────────────────────────────────────────────────────────────────

export function buildAgent(chat_stage_id: string, pre_survey_stage_id: string | null, post_survey_stage_id: string | null, agentTemplate: Record<string, any>, stageIdsInOrder: string[]): AgentParticipantTemplate {
  const tpl = agentTemplate

  return {
    persona: buildPersona(tpl),
    promptMap: {
      [chat_stage_id]: _chatPrompt(tpl, chat_stage_id, stageIdsInOrder),
      // Runs without the surveys around the chat get no prompts for them.
      ...(pre_survey_stage_id
        ? { [pre_survey_stage_id]: _pre_survey_stage(tpl, pre_survey_stage_id, stageIdsInOrder) }
        : {}),
      ...(post_survey_stage_id
        ? { [post_survey_stage_id]: _post_survey_stage(tpl, post_survey_stage_id, stageIdsInOrder, [chat_stage_id], [chat_stage_id]) }
        : {}),
    },
  }
}
