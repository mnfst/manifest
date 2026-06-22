---
"manifest": patch
---

Stop index migrations from deadlocking deploys against live traffic. The agent_messages index migrations used blocking DDL (plain CREATE/DROP INDEX), which takes an ACCESS EXCLUSIVE lock and deadlocked against live INSERTs while the previous deployment was still serving — failing every deploy and leaving the schema (and the dashboard perf work) unshipped. Those migrations now run CONCURRENTLY (SHARE UPDATE EXCLUSIVE, which does not conflict with writes) outside a transaction, and the migration runner uses per-migration ('each') transactions. The covering index also builds without a write stall.
