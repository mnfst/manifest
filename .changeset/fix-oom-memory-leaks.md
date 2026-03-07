---
"manifest": patch
---

Fix memory leaks causing OOM crashes under load: remove rawBody duplication on JSON requests, add SSE buffer size limit, add periodic cache eviction timers, and cap unbounded cache growth.
