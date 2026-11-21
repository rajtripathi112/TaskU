# People Connect Production Preparation

This guide describes a deployment shape; it is **not** a deployment record.
No hosting account, server, domain, or production service has been created.

## Recommended initial architecture

Use one small Linux VM for the initial low-traffic deployment:

```text
Browser -- HTTPS --> Caddy
                      |-- serves frontend/dist
                      `-- /api/* -> FastAPI/Uvicorn on 127.0.0.1:8000
                                      `-- /var/lib/people-connect/people_connect.sqlite3
```

Caddy terminates HTTPS and serves the static Vite build. `handle_path /api/*`
removes the `/api` prefix before forwarding to FastAPI, matching the API's
existing routes. Bind Uvicorn only to loopback and use one worker/one service
instance while SQLite is the database. Keep the SQLite file on a persistent
volume outside the source checkout and temporary directories.

This is simpler and safer for SQLite than separate static and ephemeral
application services. Same-origin routing means production can keep
`VITE_API_BASE_URL=/api` and leave `CORS_ORIGINS` empty. If the frontend and
API use different origins, set the exact public frontend origin in
`CORS_ORIGINS` and use an HTTPS `VITE_API_BASE_URL`.

## Configuration

Backend settings are read from process environment; the application does not
load `.env` files itself. `backend/.env.example` is a safe template for a
service manager. Production requires an absolute `DATABASE_PATH` outside the
system temporary directory. The app creates its parent directory when
necessary, but it **fails if the database file is missing** and never runs
`schema.sql` or replaces an existing database at startup.

Frontend `VITE_*` values are public build-time values embedded in browser
assets. Never put secrets in them. `frontend/.env.example` shows the
same-origin default. An explicit `http://` API URL is rejected during
production builds.

Development defaults remain `backend/people_connect.sqlite3` and the Vite
proxy at `http://127.0.0.1:8000`. Local commands do not require copying
`.env.example`.

## First-time database provisioning

Only for a **new, empty deployment** with no existing database file:

1. Create the persistent directory and assign it to the service account.
2. Confirm `DATABASE_PATH` does not already exist.
3. Initialize the database once from `backend/schema.sql`.
4. Run `PRAGMA integrity_check`, then start the application.

Example on Linux (replace the account/path as appropriate):

```sh
set -eu
DATABASE_PATH=/var/lib/people-connect/people_connect.sqlite3
sudo install -d -o people-connect -g people-connect -m 0750 /var/lib/people-connect
if [ -e "$DATABASE_PATH" ]; then
  echo "Refusing to initialize an existing database: $DATABASE_PATH" >&2
  exit 1
fi
sudo -u people-connect sqlite3 "$DATABASE_PATH" \
  < /opt/people-connect/backend/schema.sql
sudo -u people-connect sqlite3 "$DATABASE_PATH" \
  'PRAGMA integrity_check;'
```

Do not run the schema command against an existing database. To preserve an
existing database, take and verify a backup, then perform a separately
approved copy/import procedure. The current app has no configured Alembic
migrations.

## Build and local production-style checks

```sh
cd frontend
npm ci
VITE_API_BASE_URL=/api npm run build
```

The resulting `frontend/dist` is static output. The Vite proxy is a dev-server
feature and is not used by the build. Backend runtime dependencies are in
`backend/requirements.txt`; test-only pytest is in
`backend/requirements-dev.txt`.

From `backend`, a production process can be started behind a loopback reverse
proxy with:

```sh
uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 1
```

Set `APP_ENV=production`, `DATABASE_PATH`, and any required `CORS_ORIGINS`
through the host's service/secret manager before starting. Check
`https://<domain>/api/health` through the reverse proxy. The health endpoint
queries SQLite; it is not an authentication check.

Example Caddy site (adapt paths and hostname before use):

```caddyfile
tasks.example.com {
    encode zstd gzip
    handle_path /api/* {
        reverse_proxy 127.0.0.1:8000
    }
    handle {
        root * /opt/people-connect/frontend/dist
        try_files {path} /index.html
        file_server
    }
}
```

## Backup and restore

Take regular, access-controlled, off-host backups. Prefer SQLite's online
backup command rather than copying a live database file:

```sh
sqlite3 /var/lib/people-connect/people_connect.sqlite3 \
  ".backup '/var/backups/people-connect-$(date +%F).sqlite3'"
```

For a restore, stop the API service, preserve the current database, restore a
known-good backup to the configured path, run `PRAGMA integrity_check`, verify
file ownership/permissions, then restart and check `/api/health`. Define a
retention policy and rehearse a restore before production use; no scheduled
backup job is included in this repository.

## Security and operations gates

- Authentication/authorization is not implemented. The task API is currently
  unauthenticated and employee names are stored; do not expose it publicly for
  real data until access control is approved and tested.
- Use HTTPS for all public traffic. Keep Uvicorn bound to loopback behind the
  TLS reverse proxy; do not expose port 8000 to the Internet.
- Keep secrets in the host's secret manager/environment, not in source, `.env`
  files committed to Git, or `VITE_*` variables.
- Restrict CORS to exact HTTPS origins when cross-origin hosting is necessary.
  Do not use wildcard origins.
- Set restrictive database directory/file permissions and monitor disk usage,
  database errors, and backup freshness.
- Current Python imports are declared; runtime requirements are pinned to the
  versions tested locally. Python 3.14.8 was the local test runtime. The
  project has no full transitive Python lockfile; create and verify one before
  a repeatable production release.
- Git metadata and the Git CLI are absent from this workspace, so a Git
  status/ignore check could not be performed. A root `.gitignore` was added
  to exclude environment files, local SQLite files, and build artifacts.
- `/docs` and `/openapi.json` remain available from FastAPI. Decide whether
  public documentation exposure is acceptable before launch.
- No SRS was found. Older handover documents had described an empty frontend
  and have been corrected.

## Hosting and estimated cost

Recommended low-cost option: a 2 GiB, 1-vCPU DigitalOcean Basic Droplet is
listed at **US$12/month** (50 GiB SSD and 2,000 GiB transfer at the time
checked, 2026-11-17). The 1 GiB option is listed at US$6/month, but 2 GiB
provides more headroom for the OS, proxy, Python service, and builds. Domain
registration, taxes, optional provider backups, and monitoring are additional
and are not included. See [DigitalOcean Droplet pricing](https://www.digitalocean.com/pricing/droplets).

Cloudflare Pages offers a free static frontend option, but the backend still
needs a suitable persistent host. Render's free web services use ephemeral
filesystems and can spin down; their docs state local SQLite changes are lost
on restart/redeploy, and persistent disks require a paid service. Those free
services are therefore not appropriate for this SQLite production database.
See [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/),
[Render free services](https://render.com/docs/free), and
[Render persistent disks](https://render.com/docs/disks).

## Before deployment

1. Approve and implement authentication/authorization.
2. Choose the provider, region, domain, persistent-volume policy, backup
   retention, and operations owner.
3. Decide whether to seed a new empty database or migrate existing data.
4. Create a reproducible Python dependency lock and test the selected runtime.
5. Run staging provisioning, TLS, restart, health, CRUD, backup, and restore
   checks against a disposable database.
6. Review production logs, access control, database permissions, and public
   API documentation exposure.
7. Obtain explicit deployment approval. This preparation phase does not
   deploy the application.
