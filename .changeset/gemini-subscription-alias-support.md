---
"manifest": patch
---

Fix Gemini subscription not being recognized when provider is stored with alias 'google' instead of canonical 'gemini' id.

The `isManifestUsableProvider` function was checking if a subscription provider was supported by looking up the provider name directly in `SUBSCRIPTION_PROVIDER_CONFIGS`. However, `SUBSCRIPTION_PROVIDER_CONFIGS` only has 'gemini' as a key, not 'google' (which is an alias for 'gemini' in the provider registry).

When a subscription record was stored with `provider: 'google'` (the alias) instead of `provider: 'gemini'` (the canonical id), the check would fail and the provider would be incorrectly filtered out as "not usable" for routing.

The fix resolves the provider to its canonical ID using the shared provider registry before checking subscription support, so both 'gemini' and 'google' are correctly recognized as supported subscription providers.