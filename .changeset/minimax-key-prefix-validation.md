---
"manifest": patch
---

Relax MiniMax API key validation to use the generic provider prefix check (`sk-`) and remove the provider-specific validation branch.

Also update the MiniMax key placeholder to `sk-...` so UI guidance matches accepted key formats.
