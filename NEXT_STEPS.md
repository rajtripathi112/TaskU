# People Connect Next Steps

Phase 5 QA is complete. Phase 6 prepares configuration and documentation but
does not deploy the application. Follow `DEPLOYMENT.md` only after the
remaining gates below are approved.

## Required before any public production use

1. Decide and implement authentication/authorization. The current task API is
   unauthenticated and exposes task/employee data; do not publish it for real
   use until access control is approved and tested.
2. Select the hosting provider, domain, operating system, persistent storage,
   and operational owner. Confirm the provider's backup, recovery, logging,
   availability, and data-location policies.
3. Decide whether the existing empty local database is the initial production
   database or whether a controlled import is required. Back up and verify any
   existing data before moving it.
4. Choose a supported Python runtime and create a reproducible backend
   dependency lock from the pinned runtime requirements.
5. Test provisioning, TLS, service restart, health checks, and backup/restore
   on a staging host with a disposable database.
6. Configure secrets and environment values in the host's secret/service
   manager. Keep `.env` files and SQLite databases out of source control.
7. Approve deployment explicitly. No hosting account, service, domain, or
   deployment has been created.

## Operational follow-up

- Add a scheduled off-host SQLite backup and perform a restore drill.
- Define retention, alerting, access logging, and incident ownership.
- Revisit SQLite if multiple replicas, higher concurrent writes, or
  zero-downtime scaling become requirements; any PostgreSQL move needs an
  approved migration and rollback plan.
- Reconcile older SRS/requirements if they become available. No SRS was found
  in the current workspace.
