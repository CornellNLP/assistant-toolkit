# TrAuSt Toolkit

A Next.js web app for building and testing conversational AI agents (mediators and assistants) on top of the ConvoArena / Deliberate Labs experiment platform. You write prompts in a block-based editor, launch live test conversations or fully simulated (agent-agent) ones, and download the results as a ConvoKit corpus.

The toolkit builds in part on the [ConvoKit](https://convokit.cornell.edu) and [Deliberate Labs](https://github.com/PAIR-code/deliberate-lab) open source projects.

## Toolkits

All toolkits need a Google sign-in (Firebase Auth). Signed-out visitors are sent to `/login`.

| Route | Toolkit | Sign-in page |
| --- | --- | --- |
| `/mediator` | Mediator Toolkit | `/login/mediator` |
| `/assistant-reddit` | Assistant Toolkit - Reddit | `/login/assistant-reddit` |
| `/assistant-wp` | Assistant Toolkit - Wikipedia | `/login/assistant-wp` |

`/login` is the general hub, titled **Assistant Toolkits**. Once signed in, it lists all three toolkits. Each dedicated sign-in page sends the user straight to its own toolkit.

All three toolkits share the same workflow:

1. **Prompt Editors**: build the agent's prompts out of blocks using **+ Add item**. Freeform Text blocks hold your own instructions. The other blocks are filled in with conversation information when the agent runs. Each toolkit offers its own set of blocks, listed in its section below.
2. **Configuration**: adjust a few settings for the agent (listed per toolkit below).
3. **Testing**: create a live conversation in one of three modes: `human-agent`, `human-human`, or `agent-agent`. Names read participant 1 then participant 2, so `human-agent` means participant 1 is a human and participant 2 is an AI agent. The result shows links you can open to join as a participant.
4. **Simulation**: run fully simulated agent-agent conversations (choose the number of cohorts and utterances), then download them as a ConvoKit corpus (zip).
5. **Save / YAML import-export**: save your work as a named template, or move it in and out as YAML.

Each toolkit is independent: there are no links between them, so you open one through its own sign-in page or the `/login` hub. Saved templates are stored per user in Firestore (`toolkitDevelopers/{email}/{collection}`): `mediators`, `assistants-reddit`, and `assistants` (used by the Wikipedia toolkit). Once a template is saved, later edits to it are saved automatically a moment after you make them. Daily simulation runs are capped per user (`dailySimLimit` in Firestore `toolkit/config`, default 10). The quota is shown on each page.

Prompts saved before the Simulation Toolkit was retired may still contain a custom block. It shows up as a grey **(legacy block)** chip: it still runs as plain text from its saved copy, but it can't be edited, so remove it and use Freeform Text instead.

### Mediator Toolkit (`/mediator`)

Build and test a **mediator**: an agent that joins a group discussion and steps in to keep it productive and civil.

- **Prompt editors** (one tab each):
  - **Intervention Prompt**: generates the mediator's message whenever it decides to intervene.
  - **Should Intervene**: run after each message; the model returns true/false for whether the mediator should speak now.
  - **Initialization Prompt**: run once at the start to gather information the mediator can use later. Its output is available in the other prompts through the Initialization Result block.
- **Blocks**: Freeform Text, Participant Profiles, Conversation Context, Profile Info, Participant Info, Participant Chat Input, and Initialization Result. The Initialization Prompt offers only Freeform Text and Participant Profiles. The debate-only blocks (Debate Topic, Debate Statement, Participant Initial Positions, Target Position) are hidden in this toolkit.
- **Mediator Parameters**: Typing Speed (words per minute; 0 for instant messages), Min User Messages Before Responding, Temperature, and Initial Message.
- **Testing / Simulation**: each run uses a topic drawn at random from the default topic set (`congestion_pricing` or `covenant_marriage` in `public/templates/topics/`; see `app/lib/topicSets.ts`). Simulations can be downloaded as a raw simulation export (JSON) or as a ConvoKit corpus (zip).
- **Extras**: a guided tour (**Take a tour**), a tutorial video, the worked-examples doc, and a **Submit…** menu linking to the Track 1 / Track 2 submission forms.

The editor starts from `public/templates/defaults/mediator.yaml` merged with `public/templates/simulation/mediator.yaml`. Despite its folder name, the latter is the Mediator's current default and has nothing to do with the retired Simulation Toolkit.

### Assistant Toolkit - Reddit (`/assistant-reddit`)

Build an **assistant** (an agent that privately helps one participant during a conversation, instead of speaking to the whole group) for **r/ChangeMyView (CMV)-style threads**. The conversation starts from a CMV post, in which the original poster (OP) states a view and asks others to change it.

- **Prompt editors**: **Assistant Prompt** (the guidance sent to the participant) and **Should Intervene** (whether now is a good time to send it).
- **Blocks**: Freeform Text, Post Title, Post Description, Rule (one of the CMV rules), Participant Role (OP or Challenger), Conversation Context, Profile Info, Current Draft, Previous Assistant Message, and Previous Draft.
- **Assistant Persona**: Name and Min Call Interval (ms).
- **CMV Topic**: pick one of the bundled CMV posts (title, body, and a link to the original thread). Only the post is used as the topic, not the thread's actual discussion. The posts are defined in `app/assistant-reddit/topics.ts`.
- **Test Settings**:
  - *OP in conversation*: which participant (1 or 2) plays the OP; the other is the Challenger.
  - *Assistant given to*: participant 1, participant 2, or both. When both get one, each receives an assistant built for their own role.
  - *Chat settings*: **Show assistant replies to everyone** and **Let participants delete any message** (both on by default). These apply to the test experiment only. They are kept for the browser tab, not saved in the template.

Templates are in `public/templates/reddit/` (`assistant.yaml`, `experiment.yaml`, `agent-1.yaml`, `agent-2.yaml`).

### Assistant Toolkit - Wikipedia (`/assistant-wp`)

An assistant toolkit, like the Reddit one, for **Wikipedia talk-page style discussions** about an article.

- **Prompt editors**: **Assistant Prompt** and **Should Intervene**, as in the Reddit toolkit.
- **Blocks**: Freeform Text, Article Page (the article being discussed), Conversation Context, Participant Info, Participant Chat Input, Latest Assistant Message, and Latest Participant Draft.
- **Assistant Persona**: Name and Min Call Interval (ms).
- **Test Settings**:
  - *Wikipedia Article*: pick one of the bundled articles in `app/assistant-wp/topics.tsx`, or enter any article title. The raw article text is then fetched live from en.wikipedia.org through `/api/wikipedia-article`.
  - *Assistant given to*: participant 1, participant 2, or both.
- **Retrieval Information**: choose which Wikipedia policies and guidelines (e.g. `WP:Civility`, `WP:Neutral point of view`, `WP:Verifiability`) the assistant can draw on. They are grouped by type: Conduct, Content, Deletion, Enforcement, Legal, Procedural, and Miscellaneous. The list is in `app/assistant-wp/retrieval.tsx`.

Templates are in `public/templates/wikipedia/`.

## Project structure

```
app/
  mediator/            Mediator Toolkit (renders components/MediatorApp.tsx)
  assistant-reddit/    Reddit assistant toolkit + CMV posts (topics.ts)
  assistant-wp/        Wikipedia assistant toolkit + articles (topics.tsx) and policies (retrieval.tsx)
  login/               Sign-in hub and per-toolkit sign-in pages
  components/          Shared UI (prompt editor, save/YAML sections, …)
  lib/                 Firebase clients, drafts, auto-save, topics, guided tour
  api/                 Server routes: create-experiment, simulation-status, convokit,
                       export-experiment, templates, quota, wikipedia-article, …
public/templates/      Default YAML templates for each toolkit and topic set
convokit-service/      Python FastAPI service that converts experiments to ConvoKit corpora
```

## Getting started

Create the two per-deployment config files from their examples and fill in your Firebase project's values (both files are gitignored):

```bash
cp app/lib/firebase.example.ts app/lib/firebase.ts
cp app/api/create-experiment/config.example.ts app/api/create-experiment/config.ts
```

`FIREBASE_SERVICE_ACCOUNT` in `.env` must be for the same project as `app/lib/firebase.ts`; the server refuses to start otherwise.

Install dependencies and start the dev server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You'll be redirected to `/login`.

In development (`npm run dev`), experiments are created on a **local ConvoArena Functions emulator** at `127.0.0.1:5001`. A production build talks to the deployed backend instead. The endpoints are in `app/api/create-experiment/config.ts`.

`npm run dev` first runs `scripts/sync-dl-key.mjs`. That script copies `DL_API_KEY` from a sibling `../TrAuSt/.env` checkout into this repo's `.env`, so that the dev server uses the key minted by the locally running backend. Set `DL_ENV_PATH` to point the script at a different `.env` file.

If you're using a local version of ConvoArena, set the project id in the local URLs in `app/api/create-experiment/config.ts` to the project in its `.firebaserc`. Otherwise every create request fails with `create_experiment failed: Not Found` or `create_simulation failed: Not Found`.

### Environment variables

| Variable | Purpose |
| --- | --- |
| `DL_API_KEY` | API key for the ConvoArena / Deliberate Labs backend |
| `FIREBASE_SERVICE_ACCOUNT` | Firebase Admin service-account JSON (server-side auth, quota checks, saved templates). Required: without it, the server routes fail as soon as they load. |
| `CONVOKIT_SERVICE_URL` | URL of the ConvoKit service (defaults to `http://127.0.0.1:8080`) |
| `DL_ENV_PATH` | Optional: alternate `.env` file for `sync-dl-key.mjs` to read from |

Write each entry as `NAME=value`. A line like `DL_API_KEY:value` is silently ignored, and the key ends up empty. `.env` is gitignored; never commit it.

After changing `.env`, restart `npm run dev`: the server only reads it at startup.

### ConvoKit service

Corpus downloads need the ConvoKit service. To run it locally:

```bash
cd convokit-service
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8080 --reload
```

See [convokit-service/README.md](convokit-service/README.md) for Cloud Run deployment.

## Deployment

`docker-compose.yml` runs the web app (port 3000, bound to localhost) together with the ConvoKit service:

```bash
docker compose up --build
```

The app can also be deployed to Vercel (`vercel.json`).
