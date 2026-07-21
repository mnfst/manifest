---
'manifest': patch
---

Treat empty ChatGPT Codex streams as provider failures so routing can use fallbacks. Self-hosted deployments can tune the semantic-output wait with `CODEX_SEMANTIC_OUTPUT_TIMEOUT_MS`.
