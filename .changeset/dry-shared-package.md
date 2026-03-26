---
"manifest": patch
---

Create packages/shared to centralize duplicated constants, types, and utilities across backend, frontend, and plugin. Moves TIERS, TIER_LABELS, AUTH_TYPES, API_KEY_PREFIX, MODEL_PREFIX_MAP, inferProviderFromModel, ResolveResponse, and subscription-capabilities into a single source of truth.
