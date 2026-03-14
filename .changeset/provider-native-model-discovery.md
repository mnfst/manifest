---
"manifest": minor
---

Replace static model seeding with provider-native model discovery via live API calls

- Add `ProviderModelFetcherService` with config-driven fetchers for all 12 providers
- Add `ModelDiscoveryService` orchestrator that discovers, enriches, and caches models per provider
- Refactor `PricingSyncService` into OpenRouter pricing lookup cache (no DB writes)
- Refactor `ModelPricingCacheService` to read from OpenRouter cache + manual pricing reference
- Add `cached_models` and `models_fetched_at` columns to `user_providers`
- Drop `model_pricing`, `model_pricing_history`, and `unresolved_models` tables
- Remove static model seed data and hardcoded frontend model lists
- Add "Refresh models" button to routing UI
- Add `POST /api/v1/routing/:agent/refresh-models` endpoint
