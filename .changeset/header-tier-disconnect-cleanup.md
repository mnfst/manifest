---
"manifest": patch
---

Fix custom (header) routing tiers keeping stale account pins after disconnecting one of several accounts on the same provider. Provider-reference cleanup only updated complexity and specificity tiers, so disconnecting an account, renaming a key, or deactivating all providers left header-tier routes pointing at a removed account (the account chip then rendered blank). `relabelOverrides`, `cleanupProviderReferences`, and `deactivateAllProviders` now clean `header_tiers` routes the same way.
