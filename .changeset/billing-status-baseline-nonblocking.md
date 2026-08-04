---
'manifest': patch
---

Stop blocking `/billing/status` and free-tier admission on the historical request-usage baseline scan; return the live counter immediately and finish the baseline in the background. Dashboards no longer wait on billing at all: the plan is resolved once at login via the new light `GET /api/v1/billing/plan` and read synchronously, so Overview, Global Overview, and the Requests log fetch each chart exactly once at the right range.
