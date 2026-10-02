import path from 'path'
import {resolveDlApiKey} from '../dl-key'


export const SEED = 123

const LOCAL = process.env.NODE_ENV === 'development'


// The local Functions emulator's project id must match whatever project it
// was actually started for (see .firebaserc in that backend checkout) — it
// has no relation to which project the deployed (non-local) URL below points
// at, so don't assume they're the same string. Set DL_EMULATOR_PROJECT in
// .env when your emulator runs a different project (e.g. traust-491612 for a
// TrAuSt checkout); otherwise every local call comes back "Not Found".
const EMULATOR_PROJECT = process.env.DL_EMULATOR_PROJECT || 'convoarena-assistant'

export const BASE_URL = LOCAL
? `http://127.0.0.1:5001/${EMULATOR_PROJECT}/us-central1/api/v1`
: 'https://us-central1-convoarena-assistant.cloudfunctions.net/api/v1'




export const CREATE_PARTICIPANT_URL = LOCAL
? `http://127.0.0.1:5001/${EMULATOR_PROJECT}/us-central1/createParticipant`
: 'https://us-central1-convoarena-assistant.cloudfunctions.net/createParticipant'




export const FRONTEND_BASE = LOCAL
  ? 'https://localhost:4201'
  : 'https://convoarena-assistant.web.app'

export const API_KEY = resolveDlApiKey()

export const PROJECT_ROOT = process.cwd()

export const MEDIATOR_DEFAULT = path.join(PROJECT_ROOT, 'public', 'templates', 'defaults', 'mediator.yaml')
export const ASSISTANT_DEFAULT = path.join(PROJECT_ROOT, 'public', 'templates', 'defaults', 'assistant.yaml')
export const EXPERIMENT_DEFAULT = path.join(PROJECT_ROOT, 'public', 'templates', 'defaults', 'experiment.yaml')
export const COMPETITION_MEDIATOR = path.join(PROJECT_ROOT, 'public', 'templates', 'competition', 'mediator.yaml')

export const STAGE_R1 = 'chat-round-1'
export const PRE_SURVEY_STAGE_ID = "pre-survey"
export const POST_SURVEY_STAGE_ID = "post-survey"

export const COMPLETION_CODE = ''
