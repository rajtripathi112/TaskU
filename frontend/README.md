# People Connect Frontend

React task-management UI built with Vite. API calls go through
`src/api/client.js`; the frontend does not use browser storage as its task
data source.

## Development

```powershell
npm.cmd install
npm.cmd run dev
```

Vite serves `http://localhost:5173` and proxies `/api` to
`http://127.0.0.1:8000`, stripping `/api` before forwarding. This proxy is
development-only. `VITE_API_BASE_URL` can override the API base; it defaults
to `/api`.

## Production build

```powershell
npm.cmd run build
npm.cmd run preview
```

Set `VITE_API_BASE_URL` at build time. Prefer `/api` with a same-origin HTTPS
reverse proxy. A separately hosted API must use an HTTPS URL and configure
that exact frontend origin in backend `CORS_ORIGINS`. Never put credentials
or private values in `VITE_*` variables; Vite embeds them in browser assets.
`frontend/.env.example` is a safe template and is not loaded automatically.

See `../DEPLOYMENT.md` for the proposed hosting topology and operational
requirements.
