Guidio AI
Guidio AI is a free AI-powered career guidance and study-support platform for students and fresh graduates from any field of study. Students create a profile, then get personalised skill-gap analysis, career roadmaps, mock interviews and an AI study assistant.
Status: frontend and backend are complete. Backend details, API reference and AI provider setup are in [README.md](guidio-backend/README.md).

---
Table of contents
1. Features
2. Screenshots
3. Tech stack
4. Architecture
5. Folder structure
6. Prerequisites
7. Windows 11 setup
8. Environment variables
9. Run locally (localhost)
10. Run on your local network (LAN)
11. API overview
12. Clerk Development Mode
13. AI providers and free-tier limitations
14. MongoDB configuration
15. Deployment
16. GitHub workflow
17. Troubleshooting
18. Security notes
19. Free hosting limitations
---
Features
- Landing page with feature overview, how it works, FAQ and calls to action.
- Authentication with Clerk (sign in, sign up, protected routes, redirect handling).
- Student onboarding: four steps that save to your account after each step.
- Student dashboard: profile completion, career readiness score, skill match, interview count, recent activity, next steps. Every number comes from the backend. If there is no data yet, an empty state is shown.
- AI Student Assistant: streaming chat, conversation history, Markdown and code rendering, copy button.
- Skill Gap Analysis: match percentage, strengths, missing skills by priority, learning plan, project ideas, report history.
- Career Guidance: readiness score, recommended and alternative roles, roadmap, projects, interview topics, plan history.
- AI Mock Interview: Technical, HR or Mixed interviews, three difficulty levels, per-answer feedback and scores, final summary.
- Interview History: past interviews with scores, status and detailed feedback.
- Student Profile: edit education, skills, interests and career goals, with unsaved-changes protection.
- Settings: account information from Clerk, light/dark/system theme, sign-in methods, sign out and AI usage information.
- Weekly readiness reminders and notifications (background job with Inngest).
- Light and dark themes, responsive from 320 px phones to large desktops.
Screenshots
Add your own screenshots to a docs/screenshots/ folder and link them here:

![Landing page](docs/screenshots/landing.png)

![Dashboard](docs/screenshots/dashboard.png)

![Mock interview](docs/screenshots/mock-interview.png)

Tech stack
| Area | Technology |

|---|---|

| Frontend | React 19, Vite 8, JavaScript (JSX), React Router 8 |

| Styling and UI | Tailwind CSS 4, shadcn-style components on Base UI, Lucide icons |

| Authentication | Clerk (@clerk/react, @clerk/express) |

| Backend | Node.js, Express 5 |

| Database | MongoDB with Prisma ORM 6 |

| AI | Google Gemini (primary), Groq (fallback) and optional local Ollama, with automatic failover |

| Background jobs | Inngest |

| Validation and security | Zod, Helmet, CORS, express-rate-limit |

| Hosting | Vercel (frontend), Render (backend), MongoDB Atlas (database) |
Architecture

 Browser (React + Clerk)

        │  HTTPS, Authorization: Bearer \<Clerk session token>

        ▼

 Vercel (static frontend)          Render (Express API)

                                     │

                                     ├── Clerk  (verifies the session token)

                                     ├── MongoDB via Prisma  (users, profiles, plans, interviews)

                                     ├── AI providers (Gemini, then Groq, then optional Ollama; server-side only)

                                     └── Inngest  (weekly reminders, interview summaries)

- The browser never talks to MongoDB or an AI provider. Only the Express API does.
- The browser only holds the Clerk publishable key. Secret keys live on the server.
- The AI Assistant streams answers with Server-Sent Events.
Folder structure

Guidio-Ai/

├── guidio-frontend/             React frontend (deployed to Vercel)

│   ├── public/

│   ├── src/

│   │   ├── app/                 Theme context and provider

│   │   ├── components/

│   │   │   ├── common/          Shared pieces: page header, empty/error states, skeletons...

│   │   │   └── ui/              shadcn-style base components

│   │   ├── features/            One folder per feature

│   │   │   ├── assistant/ auth/ career/ dashboard/ interview/

│   │   │   ├── landing/ onboarding/ profile/ settings/ skill-gap/

│   │   ├── hooks/               use-theme, use-cooldown

│   │   ├── layouts/             App layout (sidebar + header)

│   │   ├── lib/                 api-client, navigation, AI error helpers

│   │   ├── pages/               Route-level pages (lazy-loaded)

│   │   ├── styles/              globals.css (design tokens)

│   │   ├── App.jsx              Routes

│   │   └── main.jsx             Clerk + router + theme providers

│   ├── .env.example

│   └── vercel.json              SPA rewrite for React Router

├── guidio-backend/              Express API (deployed to Render)

│   ├── prisma/schema.prisma

│   ├── src/

│   │   ├── ai/                  Provider manager, Gemini/Groq/Ollama adapters, prompts and schemas

│   │   ├── config/              env.js, prisma.js

│   │   ├── controllers/

│   │   ├── inngest/             Background functions

│   │   ├── middleware/          auth, validation, rate limits, error handlers

│   │   ├── routes/

│   │   ├── services/

│   │   ├── utils/

│   │   └── server.js

│   └── .env.example

└── README.md

Prerequisites
- Node.js 22.22 or newer (22 LTS). The frontend's router needs it. Check with node -v.
- npm (included with Node.js).
- Git.
- VS Code (recommended).
- Free accounts: Clerk, MongoDB Atlas, Google AI Studio (for a Gemini API key), GitHub. For deployment: Vercel and Render. Optional: Inngest.
Windows 11 setup
1. Install Node.js (LTS, version 22.22 or newer) from <https://nodejs.org>. Open a new terminal and check:
   
   node -v
   
   npm -v
   
   git --version
2. Open the project folder in VS Code and use Terminal → New Terminal (PowerShell).
3. If PowerShell says npm.ps1 cannot be loaded because running scripts is disabled, run this once, then open a new terminal:
   
   Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
   
   (Or use Command Prompt instead of PowerShell.)
Frontend installation

cd guidio-frontend

npm install

copy .env.example .env.local

Then edit guidio-frontend/.env.local (see Environment variables).
Backend installation

cd guidio-backend

npm install

copy .env.example .env

npx prisma generate

Then edit guidio-backend/.env.

If your Atlas database is brand new and empty, create its collections once:

npx prisma db push

(MongoDB does not use prisma migrate. db push applies the schema directly. It does not delete existing data for additive changes, but always read what Prisma prints before confirming anything.)
Environment variables
Real values go only in guidio-frontend/.env.local and guidio-backend/.env. Both are ignored by Git. The .env.example files contain placeholders and are safe to commit.
Frontend (guidio-frontend/.env.local, public by design)
Everything starting with VITE_ is embedded in the browser bundle. Never put a secret here.

| Variable | Purpose |

|---|---|

| VITE_API_BASE_URL | Backend address, for example http://localhost:5000. No trailing slash needed. |

| VITE_CLERK_PUBLISHABLE_KEY | Clerk publishable key (pk_test_...). Safe to expose. |
Backend (guidio-backend/.env, secret)
| Variable | Required | Purpose |

|---|---|---|

| PORT | yes | Port the API listens on (default 5000). Render sets this for you. |

| NODE_ENV | no | development locally, production on Render. |

| CORS_ORIGINS | production | Comma-separated frontend origins allowed by CORS, for example https://your-app.vercel.app. The older CLIENT_URL, FRONTEND_URL and FRONTEND_LOCAL still work. |

| FRONTEND_LOCAL | no | Extra allowed origin. Defaults to http://localhost:5173. |

| FRONTEND_URL | no | Extra allowed origin, used for your LAN address (see below). |

| CLERK_SECRET_KEY | yes | Clerk secret key (sk_test_...). Never expose. |

| CLERK_PUBLISHABLE_KEY | yes | Same publishable key as the frontend. Used by the Clerk middleware. |

| DATABASE_URL | yes | MongoDB connection string. Secret. |

| GEMINI_API_KEY | one AI key | Google Gemini key. Secret. Add GROQ_API_KEY for a free fallback. |

| INNGEST_DEV | no | 1 for local development with the Inngest dev server. Leave unset in production. |

| INNGEST_EVENT_KEY | production | Inngest event key, if you use Inngest Cloud. |

| INNGEST_SIGNING_KEY | production | Read automatically by the Inngest SDK in production, if you use Inngest Cloud. |

The server refuses to start if DATABASE_URL, CLERK_SECRET_KEY or CLERK_PUBLISHABLE_KEY is missing, if no AI provider is configured, or if CORS_ORIGINS is empty in production. See [README.md](guidio-backend/README.md) for every variable.
Run locally (localhost)
Use two terminals.

Terminal 1: backend

cd guidio-backend

npm run dev

You should see Guidio-Ai Backend Started and the port. Check <http://localhost:5000/api/health>. It should return "status": "healthy".

Terminal 2: frontend

cd guidio-frontend

npm run dev

Open <http://localhost:5173>.

Other useful frontend commands:

npm run lint      # ESLint

npm run build     # production build into guidio-frontend/dist

npm run preview   # serve the production build locally

Optional: to inspect bundle sizes, run $env:ANALYZE="true"; npm run build and open guidio-frontend/dist/stats.html.
Run on your local network (LAN)
This lets a phone or another laptop on the same Wi-Fi open the app running on your Windows laptop.
1. Find your laptop's IPv4 address. In PowerShell run ipconfig and look for IPv4 Address under your Wi-Fi adapter, for example 192.168.1.25. It can change when you reconnect. Check it again if LAN access suddenly stops working.
2. Frontend: Vite is already configured with host: true, so it listens on all network interfaces. After npm run dev, Vite prints a Network: URL.
3. Point the frontend at the backend using the LAN address. In guidio-frontend/.env.local:
   
   VITE_API_BASE_URL=http://192.168.1.25:5000
   
   Restart npm run dev after changing it. (localhost would point to the phone itself, not your laptop.)
4. Allow the frontend origin in the backend CORS list. In guidio-backend/.env:
   
   FRONTEND_URL=http://192.168.1.25:5173
   
   Restart the backend. The server prints every allowed origin on start-up. Check yours is listed.
5. Windows Firewall. Allow inbound connections on both ports for Private networks. Run PowerShell as Administrator:
   
   New-NetFirewallRule -DisplayName "Guidio AI Frontend 5173" -Direction Inbound -Protocol TCP -LocalPort 5173 -Action Allow -Profile Private
   
   New-NetFirewallRule -DisplayName "Guidio AI Backend 5000" -Direction Inbound -Protocol TCP -LocalPort 5000 -Action Allow -Profile Private
   
   Make sure your Wi-Fi is set to a Private network (Settings → Network & internet → Wi-Fi → your network → Network profile type).
6. On the phone, open http://192.168.1.25:5173.
Clerk note: Clerk Development instances work on localhost and on LAN addresses. If sign-in behaves strangely on the phone, see Troubleshooting.
API overview
All routes except health require Authorization: Bearer \<Clerk session token>. Responses use { "success": true|false, "message": "...", "data": ... }.

| Method and path | Purpose |

|---|---|

| GET /api/health | Health check (public). Used by Render. |

| GET /api/users/me | Sync and return the signed-in user. |

| GET, PUT /api/profile | Read or save the student profile. |

| GET /api/dashboard | Dashboard data. |

| GET, POST /api/assistant/conversations | List or create conversations. |

| GET, DELETE /api/assistant/conversations/:id | Read or delete a conversation. |

| POST /api/assistant/conversations/:id/messages | Send a message. The reply streams as Server-Sent Events. |

| GET, POST /api/career/plans, GET /api/career/plans/:id | Career guidance plans. |

| GET, POST /api/skill-gap/reports, GET /api/skill-gap/reports/:id | Skill gap reports. |

| GET, POST /api/interviews, GET /api/interviews/:id | Mock interviews. |

| POST /api/interviews/:id/questions/:questionId/answer | Submit an answer for AI feedback. |

| GET /api/reminders, PATCH /api/reminders/:id/read, PATCH /api/reminders/read-all | Notifications. |

| /api/inngest | Inngest endpoint for background functions. |

Profile storage detail. The profile API stores education, college, degree, graduationYear, experienceLevel, targetRole, skills[] and interests[]. The frontend also collects a branch, programming languages and a field of study. Until the backend gets dedicated fields, the branch is saved inside degree as Degree | Branch, and languages are saved inside skills. The field of study is not saved: it only chooses which suggestions are shown, and is guessed again from the degree, branch and target role when a profile loads. The full name is saved to the Clerk account.
Clerk Development Mode
This project uses a Clerk Development instance (keys starting with pk_test_ and sk_test_).
- A custom domain is not required for the current setup. Development instances work on localhost, LAN addresses and *.vercel.app URLs.
- Do not switch to production mode or remove the Clerk integration unless you intend to move to a production instance with your own domain.
- Development instances are meant for development and testing, and they have usage limits. Check Clerk's current documentation before sharing the app with many users.
- Setup: create an application in the Clerk dashboard, enable the sign-in methods you want, then copy the publishable key (frontend and backend) and the secret key (backend only).
AI providers and free-tier limitations
Guidio AI tries Google Gemini first, then Groq, then an optional local Ollama model. If one is rate limited or down, the next is used automatically. Free access has per-model quotas and rate limits that providers can change at any time, so do not assume it is unlimited or guaranteed to stay free.

What the app does about it:
- Shows a clear message with a wait time when every provider is limited (HTTP 429), and pauses the send button instead of repeating failing requests.
- Keeps what you typed.
- Never shows invented usage numbers.
- Keeps API keys on the server. They are never sent to the browser.
Model names are set with GEMINI_MODEL and GROQ_MODEL in guidio-backend/.env. Providers retire models, so check Google AI Studio and the Groq deprecations page from time to time. Full details are in [README.md](guidio-backend/README.md).
MongoDB configuration
1. Create a free cluster in MongoDB Atlas.
2. Database Access: create a database user with a strong password.
3. Network Access: allow your current IP for local development. Render's free plan has no fixed outbound IP, so for the deployed backend you must allow 0.0.0.0/0. This is a trade-off: the database is then reachable from any IP, so keep the user's password strong and never reuse it.
4. Connect → Drivers: copy the connection string and add a database name, for example:
   
   mongodb+srv://\<user>:\<password>@\<cluster>.mongodb.net/guidio-ai?retryWrites=true&w=majority
   
   If the password contains special characters, URL-encode them.
5. Put it in guidio-backend/.env as DATABASE_URL.
Deployment
1. Push to GitHub
See GitHub workflow. Make sure no .env file is committed.
2. Backend on Render
1. Render → New → Web Service → connect your GitHub repository.
2. Settings:
   | Setting | Value |
   |---|---|
   | Root Directory | guidio-backend |
   | Runtime | Node |
   | Build Command | npm ci && npx prisma generate |
   | Start Command | npm start |
   | Health Check Path | /api/health |
   | Instance type | Free |
3. Environment tab: add NODE_ENV=production, CORS_ORIGINS (your exact Vercel URL, no trailing slash), CLERK_SECRET_KEY, CLERK_PUBLISHABLE_KEY, DATABASE_URL, and at least one AI provider key (GEMINI_API_KEY and/or GROQ_API_KEY). Do not set PORT. Render provides it. Add the Inngest variables only if you use Inngest Cloud.
4. Deploy, then open https://\<your-service>.onrender.com/api/health.
3. Frontend on Vercel
1. Vercel → Add New → Project → import the repository.
2. Settings:
   | Setting | Value |
   |---|---|
   | Root Directory | guidio-frontend |
   | Framework Preset | Vite |
   | Build Command | npm run build |
   | Output Directory | dist |
   | Node.js Version | 22.x (Project Settings → General) |
3. Environment Variables: VITE_API_BASE_URL = your Render URL (no trailing slash) and VITE_CLERK_PUBLISHABLE_KEY.
4. Deploy. guidio-frontend/vercel.json already rewrites every path to index.html, so refreshing on /dashboard works.
4. Connect the two
Set CORS_ORIGINS on Render to the exact Vercel URL (for example https://your-app.vercel.app), redeploy the backend, and test sign-in. The server uses the configured allowed origins; ensure your Vercel URL is included in CORS_ORIGINS.

Environment variables changed in Vercel only apply to new deployments. Redeploy after changing them.
GitHub workflow
First-time setup from the project root:

git init

git add .

git status

Read the git status output. No .env, .env.local or node_modules should appear. Then:

git commit -m "Initial commit"

git branch -M main

git remote add origin https://github.com/\<your-username>/\<your-repo>.git

git push -u origin main

Daily work:

git checkout -b feature/short-name

# ...make changes, test...

npm run lint

npm run build

git add .

git commit -m "Describe the change"

git push -u origin feature/short-name

Open a pull request on GitHub and merge into main. Vercel and Render redeploy automatically from main if auto-deploy is enabled.

Check whether a real env file was ever tracked:

git ls-files | findstr /i "\.env"

Only .env.example files should appear. See Security notes if anything else does.
Troubleshooting
| Problem | Likely cause and fix |

|---|---|

| Missing VITE_API_BASE_URL or Missing VITE_CLERK_PUBLISHABLE_KEY in the browser | guidio-frontend/.env.local is missing or misnamed. Restart npm run dev after editing it. |

| Missing required environment variable: ... when starting the server | Fill the variable in guidio-backend/.env. |

| npm.ps1 cannot be loaded | See step 3 of Windows 11 setup. |

| Install or build errors mentioning the Node version | Update to Node 22.22 or newer. Check node -v. |

| "Cannot reach the Guidio AI server" | Backend not running, wrong VITE_API_BASE_URL, or the Render free service is waking up (wait about a minute and retry). |

| Browser console shows a CORS error, or the server logs CORS BLOCKED | The frontend origin is not in the allowed list. Set CORS_ORIGINS (production) or FRONTEND_URL (LAN) to the exact origin, including http:// and the port, then restart the backend. |

| 401 Unauthorized on every request | CLERK_SECRET_KEY or CLERK_PUBLISHABLE_KEY missing, or the frontend and backend use keys from different Clerk applications. |

| Works on the laptop but not on the phone | VITE_API_BASE_URL still says localhost, the firewall is blocking ports 5173 or 5000, the laptop's IP changed, or the devices are on different Wi-Fi networks. |

| Prisma Client not found, or @prisma/client did not initialize yet | Run npx prisma generate in server. On Render, check the build command includes it. |

| Database connection errors | Wrong DATABASE_URL, unescaped special characters in the password, or your IP is not allowed in Atlas Network Access. |

| AI says the limit was reached (429) | Every AI provider's free quota is used up. Wait and try again. The app keeps your text. |

| "AI service is not configured correctly" (503) | An AI key is missing, invalid, or the model name was retired. Check the AI variables on the server. |

| First request after a while is very slow | Render's free service goes to sleep when idle and needs time to wake up. |

| Blank page after deploying to Vercel | Check the browser console for missing VITE_ variables. Redeploy after adding them. |

| Refreshing /dashboard gives a 404 on Vercel | guidio-frontend/vercel.json must be present in the guidio-frontend folder. |

| Theme flashes on page load | Hard-refresh (Ctrl+Shift+R) to clear the cached index.html. |
Security notes
- Keep secrets server-side only: CLERK_SECRET_KEY, GEMINI_API_KEY, GROQ_API_KEY, DATABASE_URL. Anything starting with VITE_ is public.
- Never commit .env or .env.local. They are listed in .gitignore. Commit only .env.example files with placeholders.
- If a real key was ever committed, shared in a chat, or uploaded anywhere, treat it as exposed and rotate it:
  1. Clerk: dashboard → API keys → roll the secret key.
  2. AI providers: revoke exposed Gemini and/or Groq keys in their provider dashboards and create new ones.
  3. MongoDB Atlas: Database Access → change the user's password (or create a new user), then update DATABASE_URL.
  4. Update the new values in guidio-backend/.env and in the Render environment, then redeploy.
  5. Removing a file from Git does not remove it from history. Rotating the key is what protects you.
- The frontend never connects to MongoDB or Gemini directly. All AI calls go through the authenticated API.
- Protected API routes verify the Clerk session on every request.
Free hosting limitations
This project is designed to run on free tiers, but free tiers have limits and the providers can change them:
- Render free services go to sleep after 15 minutes without traffic and take about a minute to start again. Scheduled background jobs depend on the server being reachable.
- AI free tiers (Gemini, Groq) have limits and terms that can change. When all providers are limited, users see a wait message.
- Clerk Development Mode is for development and demos: 100 users maximum, and session state travels in the URL, which Clerk says is not secure enough for production. Use a Clerk Production instance with your own domain before a public launch.
- MongoDB Atlas free (M0) has storage and connection limits.