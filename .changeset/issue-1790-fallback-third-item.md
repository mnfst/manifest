---
"manifest": patch
---

Stop silently wiping the saved fallback list when an unresolvable model is added (issue #1790).

`buildFallbackRoutes()` in `tier`, `specificity`, and `header-tier` services used to return `null` whenever any single model couldn't be resolved to a unique `(provider, authType, model)` tuple. `setFallbacks` then persisted that `null`, so the user's existing `fallback_routes` row was overwritten with `null` and the controller returned `[]`. The toast still said "Fallback added" — the only visible result was the previously-saved fallbacks disappearing.

PR #1825 already plugged the most common trigger by sending an explicit `routes` payload from the add handlers. This change removes the underlying footgun: `buildFallbackRoutes` now throws `400 Bad Request` instead of returning `null`, so the row is left untouched on resolution failure and the frontend shows the error.

Scoped strictly to the backend wipe path. Does not change input validation, the `authType !== undefined` guard in the add handlers, or the discovery-fallback shape of `buildFallbackRoutes`.
