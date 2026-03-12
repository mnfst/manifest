---
"manifest": minor
---

Replace 3-mode system (cloud/local/dev) with 2-axis configuration (mode × devMode). The `mode` field now only accepts `cloud` or `local` for deployment model, while `devMode` (boolean) independently controls development behaviors like skipping API keys and faster metrics. The old `mode: "dev"` is still accepted for backward compatibility but logs a deprecation warning. `devMode` is auto-detected when the endpoint is a loopback address and no `mnfst_*` API key is provided.
