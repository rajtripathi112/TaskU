# People Connect Project Architecture

## Runtime shape

Development:

```text
Browser -> React/Vite at localhost:5173 -> Vite /api proxy -> FastAPI at 127.0.0.1:8000 -> SQLite
```

Recommended initial production shape:

```text
Browser -- HTTPS --> Caddy
                      |-- static frontend build
                      `-- /api/* reverse proxy --> one FastAPI/Uvicorn process
                                                     |
                                                     `-- persistent SQLite file
```

Serving the frontend and API on one origin keeps the browser API base at
`/api` and avoids production CORS. If they are hosted on separate origins,
configure exact `CORS_ORIGINS` values and build the frontend with its public
HTTPS API URL.

## Backend

- `backend/app/main.py` creates the FastAPI application, optional explicit
  CORS middleware, health route, and task router.
- `backend/app/core/config.py` reads `APP_ENV`, `DATABASE_PATH`, and
  `CORS_ORIGINS` from process environment variables.
- `backend/app/database/connection.py` creates a SQLAlchemy SQLite engine and
  per-request sessions. It creates the parent directory if needed but refuses
  to create or replace a missing database file.
- `backend/schema.sql` is the current schema source. Startup does not execute
  it. Alembic is not configured.
- The task API uses Pydantic validation and generic database error responses.
  `/health` performs a database query.

`APP_ENV` defaults to `development`, preserving the existing backend database
path. Production requires an absolute `DATABASE_PATH` outside the operating
system temporary directory. If the file is absent, initialize it explicitly
from the schema before starting the service.

## Frontend

The React app is built by Vite. Its shared API client reads
`VITE_API_BASE_URL` at build time and defaults to `/api`. The development
proxy exists only in Vite's `server` configuration and is not included in the
production bundle. Production builds reject an explicitly configured HTTP
API URL; same-origin `/api` or an HTTPS API origin is expected.

## API contract

| Method and path | Purpose | Success |
|---|---|---|
| `GET /tasks/` | Filtered list, counts, pagination | `200` |
| `POST /tasks/` | Create task | `201` |
| `GET /tasks/{task_id}` | Retrieve task | `200` |
| `PUT /tasks/{task_id}` | Full update of editable fields | `200` |
| `DELETE /tasks/{task_id}` | Delete task | `204` |
| `GET /health` | Database connectivity check | `200` |

Validation errors return `422`, missing tasks return `404`, and handled
database errors return generic `503` responses.

## Database and scale boundary

SQLite is suitable for the initial low-traffic, single-instance deployment
provided the database file is on persistent storage, backed up, and the app
uses one service instance. SQLite serializes writers; multiple app replicas,
high write concurrency, or zero-downtime multi-instance deployment are reasons
to evaluate PostgreSQL and plan a tested migration. Do not copy the database
into an ephemeral container layer.

The tests create temporary SQLite databases through
`backend/tests/conftest.py` and override the app's database dependency. They
do not use the project DB for test records.

## Known gaps

- No authentication or authorization; the frontend's signed-in label is
  decorative. A public deployment with real employee data is not approved.
- No migration history or automated backup/restore job exists.
- Production hosting has not been tested or deployed.
- No SRS was found; legacy project documentation was corrected for the current
  implementation.
