---
'manifest': patch
---

Leave model-specific provider corrections to Autofix. Keep provider-level protocol strips (OpenAI-only fields, OpenRouter and Ollama dialect fields) so traffic does not regress when Autofix is off.
