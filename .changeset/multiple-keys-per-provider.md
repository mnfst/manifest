---
"manifest": minor
---

Add support for multiple API keys per provider per agent. Power users with several keys for the same provider (e.g. a personal + work OpenAI key) can now attach a chain of named keys, reorder them as a fallback list, and pin specific keys to specific routing tiers or specificity categories. The single-key UX is unchanged for everyone else: the modal stays pixel-identical until the user clicks "+ Add another key", then switches to a list view with Primary / Fallback N badges and inline rename/reorder/delete controls. The cap is 5 keys per provider per agent and applies only to `auth_type='api_key'`; subscription and local providers keep the one-connection flow. When the proxy hits a primary-key failure, it now walks the chain (same model, next key) before falling through to the existing fallback-models / cross-auth-type retry.
