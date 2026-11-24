# Guidio AI — Server

The backend API for **Guidio AI**, an AI-powered career guidance platform for students. It handles authentication, student data, AI generation (assistant chat, career plans, skill-gap reports, mock interviews) and background jobs.

The project is designed to run for **free**: free-tier AI APIs with automatic fallback, MongoDB Atlas, Render and Clerk. Free tiers have limits that providers can change at any time. See [Free-tier limitations](#free-tier-limitations).

## Table of contents

1. [Technology stack](#technology-stack)
2. [Architecture](#architecture)
3. [Directory structure](#directory-structure)
4. [Features](#features)
5. [Installation](#installation)
6. [Environment variables](#environment-variables)
7. [Local development](#local-development)
8. [API reference](#api-reference)
9. [AI providers](#ai-providers)
10. [Database](#database)
11. [Testing](#testing)
12. [Deployment on Render](#deployment-on-render)
13. [Free-tier limitations](#free-tier-limitations)
14. [Security notes](#security-notes)

---

## Technology stack

| Area | Technology |
|---|---|
| Runtime | Node.js 20 or newer (22 recommended), ES modules |
| Framework | Express 5 |
| Database | MongoDB Atlas through Prisma ORM 6 |
| Authentication | Clerk (`@clerk/express`) |
| AI | Google Gemini, Groq, optional local Ollama (no paid dependency) |
| Background jobs | Inngest |
| Validation | Zod |
| Security | Helmet, CORS allow-list, express-rate-limit |
| Hosting | Render (API), MongoDB Atlas (database) |

## Architecture

A modular monolith with clear layers:

```text
Request
  → Routes          define endpoints
  → Middleware      auth (Clerk), validation (Zod), rate limits
  → Controllers     HTTP only: read the request, send the response
  → Services        business logic and database access
  → Database (Prisma / MongoDB)   or   AI layer
```

The AI layer is separate from the business logic:

```text
Service → aiService → Provider manager → Gemini (primary)
                                       → Groq   (fallback)
                                       → Ollama (optional, local)
```

Services never import a provider SDK. Switching or adding a provider only touches `src/ai/`.

Cross-cutting pieces: `config/env.js` validates every environment variable at startup, `middleware/error-handler.js` turns every error into one JSON format, and `utils/logger.js` writes structured logs with personal data and secrets removed.

## Directory structure

```text
guidio-backend/
├── prisma/
│   └── schema.prisma             Data models and indexes
├── src/
│   ├── ai/
│   │   ├── providers/            gemini-provider.js, groq-provider.js,
│   │   │                         local-provider.js (Ollama), http-utils.js
│   │   ├── ai-provider-manager.js  Failover, cooldowns, retries, timeouts
│   │   ├── ai-service.js         The only AI entry point for services
│   │   ├── ai-config.js          Provider settings built from env
│   │   ├── ai-errors.js          Standard AI error codes and messages
│   │   ├── ai-response.js        Message and JSON helpers
│   │   ├── *-prompt.js           Prompts (assistant, career, skill-gap, interview)
│   │   └── *-schema.js           Zod + JSON schemas for AI output
│   ├── config/                   env.js (validated settings), prisma.js
│   ├── controllers/              One per feature, HTTP only
│   ├── inngest/                  Background functions
│   ├── middleware/               require-auth, validators, rate-limiters, error-handler
│   ├── routes/                   One router per feature
│   ├── services/                 Business logic and database access
│   ├── utils/                    logger, api-response, app-error, lifecycle
│   ├── app.js                    Express app (middleware order, routes)
│   └── server.js                 Startup and graceful shutdown
├── tests/                        node:test suites
├── .env.example
├── prisma.config.ts
└── package.json
```

## Features

- **Authentication:** every private route verifies the Clerk session token. Every database query is scoped to the signed-in user, so one user can never read another user's data.
- **AI Student Assistant:** conversations, message history, streamed replies (Server-Sent Events), partial replies saved when a stream is interrupted, conversation deletion.
- **AI Career Guidance:** generates a plan from the saved student profile (readiness score, roles, roadmap, projects, interview topics) and keeps a history.
- **AI Skill Gap Analysis:** match percentage, strengths, prioritised missing skills, learning plan, project ideas, report history.
- **AI Mock Interview:** Technical, HR or Mixed interviews, three difficulty levels, per-answer feedback and scores, final summary, history.
- **Dashboard and reminders:** aggregated dashboard data and weekly readiness reminders (Inngest, Mondays 09:00 India time).
- **AI output validation:** every AI answer that is stored or returned as data is checked with Zod first.
- **Reliability:** health endpoint, graceful shutdown, structured logs, request and AI timeouts.

## Installation

Requirements: Node.js 20+, a MongoDB Atlas cluster, a Clerk application, and at least one AI provider key.

```bash
cd server
npm install
cp .env.example .env        # Windows PowerShell: copy .env.example .env
# edit .env and fill in your own values
npx prisma generate
npm run db:push             # creates collections and indexes (see Database)
```

## Environment variables

All variables are validated at startup. The server prints the **names** of missing or invalid variables (never their values) and exits. `.env.example` is the template. Real values go only in `.env`, which Git ignores.

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `NODE_ENV` | no | `development` | `development`, `test` or `production` |
| `PORT` | no | `5000` | Render sets this automatically |
| `LOG_LEVEL` | no | `debug` locally, `info` in production | `debug`, `info`, `warn`, `error` |
| `CORS_ORIGINS` | **production** | `http://localhost:5173` locally | Comma-separated allowed browser origins, no trailing slash |
| `TRUST_PROXY` | no | `1` in production, `0` locally | Number of reverse proxies in front of the app |
| `DATABASE_URL` | **yes** | — | MongoDB connection string (secret) |
| `CLERK_SECRET_KEY` | **yes** | — | Clerk secret key (secret) |
| `CLERK_PUBLISHABLE_KEY` | **yes** | — | Clerk publishable key |
| `GEMINI_API_KEY` | one AI key required | — | Google AI Studio key (secret) |
| `GEMINI_MODEL` | no | `gemini-3.6-flash` | Model ID from Google AI Studio |
| `GROQ_API_KEY` | one AI key required | — | Groq key (secret) |
| `GROQ_MODEL` | no | `openai/gpt-oss-120b` | Groq model ID |
| `OLLAMA_BASE_URL` | one AI key required | — | Enables Ollama, for example `http://localhost:11434` |
| `OLLAMA_MODEL` | no | `llama3.2` | Local model name |
| `OLLAMA_NUM_CTX` | no | `8192` | Local context size |
| `AI_PROVIDER_ORDER` | no | `gemini,groq,ollama` | Order providers are tried in |
| `AI_TIMEOUT_MS` | no | `30000` | Limit for one provider attempt |
| `AI_LOCAL_TIMEOUT_MS` | no | `120000` | Limit for Ollama |
| `AI_STREAM_IDLE_TIMEOUT_MS` | no | `30000` | Longest silence between streamed chunks |
| `AI_MAX_RETRIES` | no | `1` | Extra attempts on the same provider for temporary errors (0–2) |
| `INNGEST_DEV` | no | — | `1` for local development with the Inngest dev server |
| `INNGEST_EVENT_KEY` | production | — | Inngest Cloud event key |
| `INNGEST_SIGNING_KEY` | production | — | Inngest Cloud signing key |

At least one of `GEMINI_API_KEY`, `GROQ_API_KEY` or `OLLAMA_BASE_URL` must be set.

## Local development

```bash
npm run dev          # starts the API with auto-reload on http://localhost:5000
npm start            # production-style start
npm test             # automated tests (no keys or internet needed)
```

Optional, for background jobs locally:

```bash
npx inngest-cli@latest dev      # then keep INNGEST_DEV=1 in .env
```

Check that the server is running:

```bash
curl http://localhost:5000/api/health
```

## API reference

All routes except `/api/health` and `/api/inngest` require the header `Authorization: Bearer <Clerk session token>`. IDs in URLs must be valid MongoDB ObjectIds (otherwise `404 not_found`).

### Response format

```jsonc
// Success
{ "success": true, "message": "Profile retrieved", "data": { } }

// Error
{ "success": false, "message": "Readable message", "errors": null, "code": "unauthorized" }
```

Common error codes: `unauthorized` (401), `not_found` (404), `invalid_json` (400), `payload_too_large` (413), `conflict` (409), `rate_limited` (429), `database_unavailable` (503), `profile_incomplete` (profile too empty for AI guidance), `email_not_verified`.

AI error codes: `rate_limited` (429), `ai_unavailable` (503), `timeout` (504), `ai_safety_blocked` (422), `ai_invalid_output` (502), `ai_not_configured` (503), plus `ai_auth_failed` / `ai_model_not_found` (503, an administrator problem). A `Retry-After` header is sent when a wait time is known.

### Endpoints

| Method and path | Body | Purpose |
|---|---|---|
| `GET /api/health` | — | Public health check |
| `GET /api/users/me` | — | Sync and return the signed-in user |
| `GET /api/profile` | — | Read the student profile (`data` is `null` if none yet) |
| `PUT /api/profile` | `education, college, degree, graduationYear, experienceLevel, targetRole, skills[], interests[]` (all optional) | Create or update the profile |
| `GET /api/dashboard` | — | Dashboard summary |
| `GET /api/assistant/conversations` | — | List conversations |
| `POST /api/assistant/conversations` | `{ title? }` (max 100) | Create a conversation |
| `GET /api/assistant/conversations/:conversationId` | — | Conversation with messages |
| `POST /api/assistant/conversations/:conversationId/messages` | `{ content }` (1–5000 chars) | Send a message; the reply **streams** |
| `DELETE /api/assistant/conversations/:conversationId` | — | Delete a conversation |
| `POST /api/career/plans` | — (uses the saved profile) | Generate a career plan |
| `GET /api/career/plans` | — | List plans |
| `GET /api/career/plans/:planId` | — | Read one plan |
| `POST /api/skill-gap/reports` | — (uses the saved profile) | Generate a skill-gap report |
| `GET /api/skill-gap/reports` | — | List reports |
| `GET /api/skill-gap/reports/:reportId` | — | Read one report |
| `POST /api/interviews` | `{ interviewType: "Technical"\|"HR"\|"Mixed", targetRole, difficulty: "Beginner"\|"Medium"\|"Hard" }` | Start an interview |
| `GET /api/interviews` | — | Interview history |
| `GET /api/interviews/:sessionId` | — | Interview details |
| `POST /api/interviews/:sessionId/questions/:questionId/answer` | `{ answerText }` (10–8000 chars) | Submit an answer for feedback |
| `GET /api/reminders` | — | List notifications |
| `PATCH /api/reminders/:reminderId/read` | — | Mark one as read |
| `PATCH /api/reminders/read-all` | — | Mark all as read |
| `/api/inngest` | — | Inngest endpoint (signed by Inngest) |

### Streaming (assistant messages)

The reply is `text/event-stream`. Each line is `data: <JSON>` followed by a blank line:

```text
data: {"type":"start"}
data: {"type":"chunk","text":"Hello"}
data: {"type":"done","data":{ ...saved messages... }}
data: {"type":"error","message":"...","code":"rate_limited","retryAfterSeconds":30}
```

If the browser disconnects, the AI request is cancelled so no quota is wasted, and any partial reply is saved. Errors before the stream starts (bad token, bad input, rate limit) are normal JSON errors.

### Health check

`GET /api/health` is public and exposes no secrets, models or error text.

```json
{
  "success": true,
  "message": "Guidio AI backend is running",
  "data": {
    "status": "healthy",
    "database": "up",
    "ai": { "status": "up", "providers": [{ "provider": "gemini", "available": true }] },
    "service": "Guidio AI API",
    "uptimeSeconds": 120,
    "timestamp": "2026-01-01T00:00:00.000Z"
  }
}
```

- **HTTP 200:** database reachable. `ai.status` can still be `degraded` or `down` (a provider is paused by a rate limit); this heals by itself, so it does not fail the check.
- **HTTP 503:** database unreachable, or the server is shutting down (`status: "shutting_down"`).
- The database result is cached for 10 seconds.

### Rate limits

| Limit | Applies to | Window |
|---|---|---|
| 300 requests | All `/api` routes, per IP address | 15 minutes |
| 30 requests | Assistant messages, career plans, skill-gap reports, per user | 15 minutes |
| 50 requests | Starting interviews and submitting answers, per user | 15 minutes |

A `429` response includes `Retry-After`.

## AI providers

Configure at least one provider in `.env`. Default order: **Gemini → Groq → Ollama**. Providers you do not configure are skipped.

| Provider | Needs | Notes |
|---|---|---|
| Gemini | `GEMINI_API_KEY` | Primary. Has a free tier with per-model limits. |
| Groq | `GROQ_API_KEY` | Optional fallback. Free plan with rate limits. |
| Ollama | `OLLAMA_BASE_URL` | Local open-source models. Cannot run on Render's free plan. |

Behaviour of the provider manager:

- **429 (rate limit):** the provider is paused for its `Retry-After` time (60 seconds if none was sent, never more than 15 minutes) and the next provider is used. It is never retried immediately.
- **Temporary errors (5xx, network, timeout):** after 3 in a row the provider is paused for 30 seconds. A same-provider retry happens only when no other provider is left.
- **Bad key or unknown model:** the provider is paused for 15 minutes and the next one is used; the problem is logged without the key.
- **Never retried or failed over:** invalid requests, safety refusals, cancellations.
- **Streaming:** failover is possible only before the first chunk is sent. After that, the partial answer is kept.
- **Structured output:** Gemini uses its JSON schema mode. Groq uses JSON mode with the schema in the prompt; Ollama uses its native JSON-schema `format`. Every answer is then validated with Zod; an invalid answer fails over to the next provider.
- **Provider health** is available to the server through `aiService.getStatus()` and is summarised (names and availability only) in `/api/health`.

**Model names change.** Groq retires models regularly. Their deprecations page lists `llama-3.3-70b-versatile` as shut down on 16 August 2026, which is why the default is `openai/gpt-oss-120b`. Check your key's available models with:

```bash
curl -s https://api.groq.com/openai/v1/models -H "Authorization: Bearer $GROQ_API_KEY"
```

(Use `$env:GROQ_API_KEY` in PowerShell.) Verify the Gemini model ID in Google AI Studio too.

**Response caching:** not implemented. All AI output is generated per user, so nothing private is ever shared between users. Caching of non-personal career information is a possible future addition.

**Fair use:** use one API key per provider, as the providers' terms intend. The code does not rotate keys or create accounts to get around limits.

## Database

MongoDB through Prisma. Models: `User`, `StudentProfile`, `AssistantConversation`, `AssistantMessage`, `CareerPlan`, `SkillGapReport`, `InterviewSession`, `InterviewQuestion`, `InterviewAnswer`, `InterviewImprovementSummary`, `WeeklyReadinessReminder`. Relationships use `onDelete: Cascade` where a record belongs to a user. Indexes (for example `userId, createdAt`) support the history lists, and unique indexes prevent duplicates (one profile per user, one reminder per user per week, one question per position).

Commands:

```bash
npx prisma generate     # create the Prisma client (also runs on Render build)
npm run db:push         # sync the schema and indexes to MongoDB
```

MongoDB has no SQL migrations. `db:push` only adds what is missing. It never wipes data on its own, but read what Prisma prints before confirming, especially if it warns about a unique index on existing duplicate data. Do not run reset commands against a production database.

Atlas Network Access: allow your IP for local work. Render's free plan has no fixed outbound IP, so the deployed API needs `0.0.0.0/0`, which means the database user's password must be strong and unique.

## Testing

```bash
npm test
```

68 automated tests run with no database, keys or internet:

- **AI layer:** the Gemini, Groq and Ollama adapters are tested against small local servers that imitate their real response formats. Covers failover, cooldowns, Retry-After, timeouts, retries, streaming and validation.
- **Reliability:** logger redaction, health reporting and the profile service (with a fake Prisma object).

These tests prove the logic. They do **not** prove that your real keys, models, MongoDB cluster or Clerk instance work. After setup, check manually: sign in, save a profile, send an assistant message, generate a plan and report, finish an interview, and open `/api/health`.

## Deployment on Render

The repository root has a `render.yaml` blueprint.

1. Push the repository to GitHub (make sure `.env` is not committed).
2. In Render choose **New → Blueprint** (or create a Web Service with Root Directory `guidio-backend`).
3. Settings: build command `npm ci && npx prisma generate`, start command `npm start`, health check path `/api/health`, instance type Free.
4. Set the secret environment variables (marked `sync: false` in the blueprint): `DATABASE_URL`, `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY`, and the two Inngest keys if you use Inngest Cloud. Set `CORS_ORIGINS` to your exact frontend URL. Do not set `PORT`.
5. Deploy and open `https://<your-service>.onrender.com/api/health`.
6. If you use Inngest Cloud, sync the app at `https://<your-service>.onrender.com/api/inngest`.

The server listens on `0.0.0.0` and the port Render provides. It opens the port first and connects to the database in the background, so cold starts are fast. On a deploy Render sends `SIGTERM`: the health check starts answering 503, running requests get time to finish, then the database disconnects and the process exits.

## Free-tier limitations

Be honest with yourself and your users about these:

- **Render free web services** spin down after 15 minutes without traffic and take about a minute to start again; the first request after a pause is slow. They also have 750 free instance hours per month per workspace, a single instance, no persistent disk, and Render may restart them at any time ([Render docs](https://render.com/docs/free)). Weekly reminder jobs only run when the server is awake or woken by Inngest.
- **AI free tiers** have per-model, per-minute and per-day limits that Google and Groq can change at any time. When every provider is limited, users see a clear message with a wait time. Free-tier data may be used by the provider according to its terms; check them before putting sensitive information in prompts.
- **Clerk Development Mode** is not meant for a public launch ([Clerk docs](https://clerk.com/docs/deployments/environments)):
  - Development instances are limited to 100 users, and users cannot be moved to a production instance.
  - Session state is passed in the URL query string instead of secure cookies, which Clerk says is not secure enough for production.
  - Sign-in pages use a Clerk `accounts.dev` domain, shared credentials for some social logins, and search engines cannot index the app.
  - Fine for a portfolio or demo with a few users. For real users, create a Clerk **Production** instance (this needs your own domain) and replace the `pk_live_` / `sk_live_` keys in Vercel and Render.
- **MongoDB Atlas free (M0)** has storage and connection limits. Check Atlas for current numbers.

## Security notes

- Secrets live only in environment variables. `.env` and every `.env.*` file except `.env.example` are in `.gitignore`.
- If a real key was ever committed, shared in a chat or uploaded anywhere, rotate it (Clerk, Gemini, Groq, and the MongoDB user password). Deleting the file from Git does not remove it from history.
- Every private route checks the Clerk session. A malformed or tampered token returns `401`.
- Database queries use the internal user id found from the verified Clerk id, never an id sent by the client.
- Input is validated with Zod; request bodies are limited to 1 MB.
- Helmet sets security headers. CORS allows only the origins in `CORS_ORIGINS`.
- Logs never contain tokens, API keys, connection strings, emails, names, or chat and prompt text. Secrets and emails that appear inside error messages are masked.
- In production, unexpected server errors return a generic message; details stay in the logs.
- The frontend never talks to MongoDB or an AI provider directly.