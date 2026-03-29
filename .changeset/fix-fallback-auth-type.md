---
"manifest": patch
---

fix: fallback chain now tries alternate auth type for same provider (#1272)

When both subscription and API key credentials exist for the same provider, the fallback chain previously reused the same (failing) auth type instead of trying the alternate credential. This resulted in 424 errors even when a valid API key was available as fallback.
