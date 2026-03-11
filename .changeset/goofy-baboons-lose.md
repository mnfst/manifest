---
'manifest': patch
---

Optimize slow backend endpoints for sub-500ms response times: parallelize independent DB queries, batch saves, pre-fetch dedup context, derive summaries from timeseries data, and group notification cron evaluation.
