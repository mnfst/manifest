---
"manifest": patch
---

Self-hosted telemetry now reports at a stable hour each day and declares the exact 24h window it covers (`window_start`/`window_end`). The send previously drifted one hour later per report, so roughly every three weeks an install skipped a UTC calendar day and its daily usage stats briefly dropped to zero. Also replaces the cross-tenant error-scan index with one covering the request-first `failed`/`auto_fixed` statuses, so error queries stay indexed for rows written after the request-first model.
