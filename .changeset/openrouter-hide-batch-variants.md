---
'manifest': patch
---

Stop listing OpenRouter `:batch` model variants in model discovery. These variants are only served through OpenRouter's asynchronous Batch API and always fail with a 404 on the synchronous chat completions proxy.
