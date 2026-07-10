---
'manifest': patch
---

Stop failing requests whose `model` isn't a provider-qualified ID. A bare model name now routes to the connection carrying it, an unrecognized one falls back to configured routing instead of erroring with "no providers configured", and a matching custom header tier again outranks the model an SDK names.
