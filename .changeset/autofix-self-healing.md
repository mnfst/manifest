---
"manifest": minor
---

Add Auto-fix: when an agent request fails with a fixable error (bad parameter, wrong format, unknown model), Manifest sends it to a healing service, applies the patched request, and retries before falling back. Opt-in per agent from the Routing page. Each healed request shows as two linked rows in the log: the failed original and the successful retry.
