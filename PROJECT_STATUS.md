# People Connect Project Status

## Current state

People Connect is a React/Vite frontend with a FastAPI/SQLAlchemy task API and
SQLite persistence. Task CRUD, status filters, server-side counts and
pagination are implemented. The frontend uses the backend as its source of
truth and the Vite development server proxies `/api` to FastAPI.

## Implemented components

- Backend entry point: `backend/app/main.py`.
- Task API and schemas: `backend/app/routers/tasks.py`,
  `backend/app/schemas/task.py`.
- Environment configuration: `backend/app/core/config.py`.
- Database engine/session: `backend/app/database/connection.py`.
- Existing schema source: `backend/schema.sql`; Alembic has no configured
  migration history.
- Frontend API client: `frontend/src/api/client.js`.
- Frontend build and development proxy: `frontend/vite.config.js`.
- Automated backend tests: `backend/tests/`, using temporary SQLite databases.

## Verification

Phase 5 recorded **64 passing backend tests**, a successful frontend
production build, and a read-only real-database check with zero tasks and
`integrity_check=ok`. Phase 6 adds environment configuration, explicit
production database-path safeguards, optional restricted CORS, and a
deployment guide. Phase 6 verification results are recorded in `WORK_LOG.txt`.

## Production status

**Not deployed.** The app is prepared for local production-style configuration
and build verification only. Authentication/authorization is absent, so the
task API must not be exposed publicly with real employee data until access
control is designed and approved. SQLite is appropriate only for a
single-instance, low-to-moderate-write workload with persistent storage and
backups.

See `DEPLOYMENT.md` for the recommended topology, configuration, backup
procedure, cost estimate, and deployment gates. No SRS file was found in the
workspace. The chronological development record is `WORK_LOG.txt`.
