---
'manifest': patch
---

Show model parameters for gateway models (e.g. OpenCode Go). A model like `opencode-go/deepseek-v4-pro` now resolves its parameters and capabilities from the underlying provider's catalog entry (`deepseek` / `deepseek-v4-pro`), so the params dialog, request snapshot, and outbound param defaults work the same as connecting the provider directly.
