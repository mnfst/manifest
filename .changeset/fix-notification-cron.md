---
"@mnfst/server": patch
---

Fix notification cron: hourly alerts never triggered because the evaluation window was empty, and failed email sends prevented retries
