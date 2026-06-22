---
"manifest": patch
---

Run database migrations under a Postgres advisory lock so concurrent runners serialize instead of deadlocking. When more than one process ran migrations at once (overlapping deployments, or replicas across regions), they could deadlock acquiring DDL locks on the high-churn agent_messages table and fail the deploy. The deploy migration step now takes a single advisory lock over the direct migration connection: the first runner applies every pending migration, the rest wait and then find nothing pending. Single-instance and self-hosted deploys are unaffected.
