---
'manifest': patch
---

Fix OpenAI subscription model discovery so newer Codex CLI models (e.g. `gpt-5.5`) appear. The hardcoded `client_version=0.99.0` query param made `https://chatgpt.com/backend-api/codex/models` silently return only the older subset; bump it to `0.128.0` and lift Codex/Copilot client identifiers into a shared constants file so future bumps are a one-line change.
