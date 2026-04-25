# Repository Structure

> Navigation reference for Claude. Describes every file and its role.

```
swellbook/
├── .claude/                          # Claude Code configuration
│   ├── CLAUDE.md                     # Personal instructions (DO NOT code unless asked)
│   ├── settings.json                 # Claude Code permissions and tool settings
│   ├── settings.local.json           # Local overrides (not committed)
│   ├── agents/                       # Specialized sub-agent definitions
│   │   ├── backend-api.md            # Agent for FastAPI routes, services, models
│   │   ├── frontend-feature.md       # Agent for Expo screens and components
│   │   └── reviewer.md               # Read-only code review agent
│   ├── commands/                     # Custom slash commands
│   │   └── code-review.md            # /code-review command definition
│   ├── rules/                        # Enforced coding conventions
│   │   ├── python-style.md           # Async, type hints, Pydantic, no print()
│   │   ├── security.md               # No hardcoded secrets, auth required on all routes
│   │   └── typescript-style.md       # Functional components, no `any`, async/await
│   └── skills/                       # Reusable task templates
│       ├── new-endpoint.md           # Scaffold a new FastAPI endpoint
│       ├── new-feature.md            # Scaffold a new frontend feature module
│       └── new-screen.md             # Scaffold a new Expo screen
│
├── app/                              # React Native / Expo frontend (TypeScript)
│   ├── App.tsx                       # Root component — mounts AppNavigator
│   ├── index.ts                      # Expo entry point (registers App)
│   ├── app.json                      # Expo project config (name, slug, icons)
│   ├── tsconfig.json                 # TypeScript compiler options
│   ├── package.json                  # Frontend dependencies
│   ├── package-lock.json             # Locked dependency tree
│   ├── .env                          # Local env vars (not committed)
│   ├── .env.example                  # Env vars template (SUPABASE_URL, etc.)
│   ├── .expo/                        # Expo internal metadata (auto-generated)
│   │   ├── README.md
│   │   └── devices.json              # Registered test devices
│   ├── assets/                       # Static image assets
│   │   ├── icon.png                  # App icon (1024x1024)
│   │   ├── adaptive-icon.png         # Android adaptive icon
│   │   ├── splash-icon.png           # Splash screen image
│   │   └── favicon.png               # Web favicon
│   ├── node_modules/                 # NPM packages (do not edit)
│   └── src/
│       ├── config/
│       │   └── supabase.ts           # Supabase client init (reads env vars)
│       ├── features/                 # Feature-based modules (one folder per domain)
│       │   ├── auth/                 # Authentication feature
│       │   │   └── LoginScreen.tsx      # Email/password login form (Supabase Auth)
│       │   ├── recorder/             # Audio recording feature
│       │   │   ├── RecorderScreen.tsx   # Main recording UI (mic button, waveform)
│       │   │   └── recorder.types.ts    # Types: RecordingState, AudioBlob, etc.
│       │   └── session/              # Session management feature
│       │       ├── SessionListScreen.tsx      # Home screen — list of past sessions (most recent first)
│       │       ├── SessionConfirmScreen.tsx   # Review and confirm a recorded session
│       │       ├── session.types.ts           # Types: Session, Spot, Forecast, SessionListItem, etc.
│       │       └── sessionApi.ts              # API calls to backend /sessions routes
│       └── navigation/
│           └── AppNavigator.tsx      # Stack/tab navigator — defines all routes
│
├── backend/                          # Python FastAPI backend
│   ├── requirements.txt              # Production dependencies (fastapi, supabase, etc.)
│   ├── requirements.dev.txt          # Dev dependencies (pytest, httpx, etc.)
│   ├── .python-version               # Pinned Python version (used by pyenv)
│   ├── .env                          # Local secrets (not committed)
│   ├── .env.example                  # Env template (SUPABASE_URL, ANTHROPIC_KEY, etc.)
│   ├── .venv/                        # Virtual environment — activate with:
│   │                                 #   source backend/.venv/bin/activate
│   ├── app/                          # Application package
│   │   ├── __init__.py
│   │   ├── main.py                   # FastAPI app factory, router registration, CORS
│   │   ├── config.py                 # Settings via pydantic-settings (reads .env)
│   │   ├── dependencies.py           # get_current_user() and other DI providers
│   │   ├── dev/
│   │   │   ├── __init__.py
│   │   │   └── test_connections.py   # Dev utility: test Supabase / external API connectivity
│   │   ├── models/                   # Pydantic schemas (request/response validation)
│   │   │   ├── __init__.py
│   │   │   ├── session.py            # Session create/read schemas
│   │   │   ├── spot.py               # Surf spot schemas
│   │   │   └── forecast.py           # Swell/weather forecast schemas
│   │   ├── routes/                   # Thin route handlers (delegate to services)
│   │   │   ├── __init__.py
│   │   │   └── sessions.py           # POST /sessions, GET /sessions, GET /sessions/{id}
│   │   └── services/                 # Business logic — all heavy lifting lives here
│   │       ├── __init__.py
│   │       ├── session_service.py    # CRUD for sessions; similarity queries via SQL ranges
│   │       ├── stormglass_service.py # Fetch retroactive swell/weather from Stormglass API
│   │       ├── whisper_service.py    # Send audio to OpenAI Whisper, return transcript
│   │       └── claude_service.py     # Send transcript to Claude, extract structured data
│   ├── migrations/                   # SQL migration files (run manually or via CI)
│   │   └── 001_init.sql              # Creates sessions, spots, forecasts, perception_deltas
│   └── tests/
│       └── __init__.py               # Test package (pytest)
│
├── scripts/                          # Developer convenience scripts
│   ├── start_backend.sh              # Activates venv + runs uvicorn (hot reload)
│   └── start_frontend.sh             # Runs `npx expo start`
│
├── docs/
│   └── architecture.svg              # System architecture diagram (Railway, Supabase, APIs)
│
├── .mcp.json                         # MCP server config (Supabase MCP tool)
├── .gitignore                        # Git ignore rules
├── .claudeignore                     # Files hidden from Claude's context
├── .env.example                      # Root-level env template
├── CLAUDE.md                         # Root project instructions for Claude
├── STRUCTURE.md                      # This file
└── README.md                         # Project overview
```

## Key entry points

| Goal | File |
|------|------|
| Start backend | `scripts/start_backend.sh` or `uvicorn app.main:app` from `backend/` |
| Start frontend | `scripts/start_frontend.sh` or `npx expo start` from `app/` |
| Add a route | `backend/app/routes/sessions.py` → delegate to `backend/app/services/` |
| Add a screen | `app/src/features/<feature>/` → register in `app/src/navigation/AppNavigator.tsx` |
| Change DB schema | Add a new file in `backend/migrations/` |
| Environment config | Backend: `backend/app/config.py` · Frontend: `app/src/config/supabase.ts` |
