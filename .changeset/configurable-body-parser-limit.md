---
'manifest': patch
---

feat: make HTTP body parser limit configurable via `BODY_PARSER_LIMIT`

Self-hosted operators routing to long-context models (1M-token windows on
Claude / Gemini, etc.) hit the hardcoded 1MB request cap before they can
fill the model's actual context. Add a `BODY_PARSER_LIMIT` env var that
overrides the limit on both `express.json` and `express.urlencoded`.

The default stays `1mb`, so cloud and existing self-hosted deployments are
unaffected. Accepts any value the `bytes` module understands (`5mb`,
`20mb`, `100kb`, …).
