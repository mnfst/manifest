---
"manifest": patch
---

Harden the tenant-scoping upgrade for large production databases. The provider-lift migration now skips rows whose agent was already deleted instead of aborting the whole upgrade with a foreign-key error, and the multi-million-row agent-message attribution backfill runs as a throttled, resumable post-deploy job (`npm run backfill:message-providers`) instead of inside the boot transaction — so upgrading no longer holds a long lock on `agent_messages`.
