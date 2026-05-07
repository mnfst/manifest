---
'manifest': patch
---

Strip the non-standard `ref` JSON Schema keyword (no `$` prefix) from Google Gemini tool parameters. Some tool emitters drop the `$` prefix because Protobuf and similar parsers reject dollar-prefixed field names; without this fix Manifest forwarded `ref` verbatim and Google rejected the request with `Invalid JSON payload received. Unknown name "ref"`.
