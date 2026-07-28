---
"manifest": patch
---

Serialize OAuth subscription token refreshes with a DB row lock (`SELECT … FOR UPDATE` on `tenant_providers`) so multi-replica backends cannot rotate the same refresh token concurrently
