---
'manifest': patch
---

Fix "Refresh models" not picking up newly-added Ollama (or any provider) models. Both refresh-models endpoints wrote the fresh model list straight to `tenant_providers.cached_models` but never invalidated `RoutingCacheService`'s 2-minute tenant-scoped provider-list cache, so `GET /api/v1/providers` (which the refresh button re-fetches right after refreshing) could keep serving the pre-refresh snapshot. Every other provider mutation already invalidated this cache; the refresh endpoints now do the same.
