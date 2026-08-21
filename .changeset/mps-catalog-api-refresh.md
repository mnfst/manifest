---
'manifest': patch
---

Keep model parameter specs current: the modelparams catalog now refreshes hourly from the modelparams.dev API (ETag-conditional, validated before swap, stale-on-error) instead of being frozen at the bundled package version, and the bundled fallback is bumped to modelparams 0.0.40.
