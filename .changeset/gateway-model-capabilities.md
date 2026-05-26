---
'manifest': patch
---

Show capability badges for gateway models in the model picker. A gateway model like `opencode-go/glm-5.1` now resolves its capabilities from the underlying provider's models.dev metadata (`zai` / `glm-5.1`) instead of showing "Capabilities unknown". The resolution is gateway-generic — it keys off the shared gateway-prefix abstraction, so any gateway added later inherits it automatically.
