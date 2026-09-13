---
'manifest': patch
---

Fix OpenAI subscription model discovery so newer Codex CLI models (e.g. `gpt-6-astra`) appear. OpenAI gates `gpt-6-astra` behind Codex CLI `0.153.0`+, and the `/backend-api/codex/models` endpoint silently returns the older model subset for older `client_version` values. Bump `CODEX_CLI_VERSION` from `0.128.0` to `0.154.0`.
