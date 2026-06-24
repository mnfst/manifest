---
"manifest": patch
---

Stop a slow memory climb on long-running servers. The global dashboard response cache used cache-manager's default in-memory store, which has no size limit and only drops entries when their exact URL is requested again. High-cardinality dashboard URLs (filters, cursors, time ranges) piled up for the life of the process. It now uses a bounded LRU store with a hard entry cap plus an active sweep of expired entries. Three proxy session caches (Anthropic thinking blocks, Gemini thought signatures, DeepSeek reasoning content) were also uncapped and now evict their oldest entries once a ceiling is reached.
