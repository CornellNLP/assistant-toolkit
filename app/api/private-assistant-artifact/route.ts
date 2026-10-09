import fs from 'fs'
import path from 'path'
import { generate } from '../create-experiment/generator'

const CORS_HEADERS = { 'Access-Control-Allow-Origin': '*' }

// randomize over the same 2 topics create-experiment uses for development
const TOPICS = ['congestion_pricing', 'covenant_marriage']

export async function POST() {
  try {
    const chosen = TOPICS[Math.floor(Math.random() * TOPICS.length)]
    const experimentTemplatePath = path.join(process.cwd(), 'public', 'templates', 'topics', chosen, 'experiment.yaml')
    const privateAssistantTemplate = fs.readFileSync(path.join(process.cwd(), 'public', 'templates', 'artifacts', 'assistant.yaml'), 'utf8')

    // no mediator; the assistant stands behind the human seat (participant-1 in human-agent mode)
    const result = await generate('participant-1', 'participant-2', experimentTemplatePath, null, 'human-agent',
      undefined, undefined, undefined, privateAssistantTemplate, undefined, undefined, 'participant-1',
      undefined, undefined, { publicNameSuffix: ' - Private Assistant Example' })
    return Response.json(result, { headers: CORS_HEADERS })
  } catch (e) {
    console.error('Error:', e)
    return Response.json({ error: String(e) }, { status: 500, headers: CORS_HEADERS })
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: { ...CORS_HEADERS, 'Access-Control-Allow-Methods': 'POST, OPTIONS' },
  })
}
