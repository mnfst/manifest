---
'manifest': minor
---

Report an agent's request-side 4xx to Phoenix as evidence, carrying the full request body, for agents that have Auto-fix on. Opt-in via `AUTOFIX_REPORT_ALL_4XX=true`; nothing is stored in Manifest.
