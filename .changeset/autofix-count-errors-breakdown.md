---
"manifest": patch
---

Add an `auto_fixed` count to the `GET /api/v1/errors/breakdown` response (number of requests healed by Auto-fix in the window), plus a typed `getErrorBreakdown()` frontend API wrapper — so a dashboard can surface auto-fixed alongside errors.
