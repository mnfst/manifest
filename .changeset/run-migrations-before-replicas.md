---
"manifest": patch
---

Stop deploys from deadlocking on database migrations. Migrations ran on every replica's boot over PgBouncer, so multi-replica deploys with pending migrations could deadlock acquiring locks on agent_messages and fail. Migrations now run once in a pre-deploy step over the direct connection (with an advisory lock so overlapping deploys serialize), before any replica starts. App-boot migration is now configurable (RUN_MIGRATIONS_ON_BOOT, default on for dev and single-instance self-hosted). The migration runner also uses the committed migration list instead of a compiled-file glob, so stale build artifacts from deleted migrations can never run.
