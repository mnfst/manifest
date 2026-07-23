---
"manifest": patch
---

Request-params snapshots are now derived from the raw request body: caller-sent parameters the model catalog has no spec for (scalars and small structured knobs, content excluded) are recorded, so failure evidence shows the exact knob a provider rejected instead of silently omitting it.
