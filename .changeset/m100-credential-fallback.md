---
"manifest": patch
---

When primary credentials fail to resolve, treat it as a failed attempt and enter the normal fallback chain instead of hard-failing with M100. Dead subscription OAuth (refresh/unwrap failed) now surfaces as M102 rather than the misleading "no API key" M100.
