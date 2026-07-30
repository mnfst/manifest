---
'manifest': patch
---

Stop blocking `/billing/status` and free-tier admission on the historical request-usage baseline scan; return the live counter immediately and finish the baseline in the background so Overview can load while the one-shot COUNT runs.
