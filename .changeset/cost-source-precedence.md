---
'manifest': patch
---

Prefer the cost a provider reports over any catalogue estimate. Manifest already read `usage.cost` from responses but only used it for subscription providers, so an exact figure from a gateway such as OpenRouter was captured and then discarded in favour of catalogue arithmetic. Local inference (Ollama, llama.cpp, LM Studio) now records a known `$0` instead of an unknown `null`.
