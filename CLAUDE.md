# Swell Book

## Architecture
- Monorepo: /app (Expo + TypeScript), /backend (FastAPI + Python)
- Database: Supabase Postgres (EU - Frankfurt)
- Hosting: Railway for backend
- External APIs: Whisper (transcription), Claude (extraction), Stormglass (forecast)

## Conventions
- Frontend: feature-based folder structure (features/session, features/recorder, etc.)
- Backend: routes are thin, logic lives in services/
- All API responses follow { data, error } shape
- French and English in voice input — always handle both

## Key decisions
- Auth via Supabase Auth with Expo SecureStore for tokens
- Session similarity uses SQL range queries, not RAG
- Forecast data fetched retroactively after session, not during
- Spots are hardcoded initially (5-6 around Biarritz)

## Database
- See backend/app/models/ for Pydantic schemas
- Supabase tables: sessions, spots, forecasts, perception_deltas

## Environment Configuration
- **Frontend Root:** `./app`
- **Backend Root:** `./backend`
- **Virtual Environment:** `./backend/.venv`
- **Activation:** Always use `source backend/.venv/bin/activate` before running backend commands.
- **Python Path:** When running scripts, ensure the working directory is `./backend` or that `backend` is added to `PYTHONPATH`.