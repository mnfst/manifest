---
"manifest": patch
---

Strip Codex-unsupported parameters on the OpenAI subscription proxy path. Requests forwarded to `chatgpt.com/backend-api/codex/responses` now drop `temperature`, `top_p`, `max_output_tokens`, `metadata`, `safety_identifier`, `prompt_cache_retention`, and `truncation` before the upstream call, and force `store: false`. Previously these fields propagated through and Codex returned `400 unsupported_parameter`, breaking OpenAI-SDK clients that set sampling defaults. Closes #1791.
