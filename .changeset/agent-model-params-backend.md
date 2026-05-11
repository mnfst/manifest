---
'manifest': minor
---

Move request body defaults (today: DeepSeek's `thinking` toggle) from tier-scoped storage to per-route storage. Settings now travel with the model identity (`agent_id`, `provider`, `auth_type`, `model_name`) wherever the model appears — default tier primary, specificity fallback, header-tier primary, anywhere. **Behavior change:** Manifest no longer auto-disables DeepSeek's thinking mode on simple/standard/complex tiers. Users who never configured a value will see the provider's natural default (thinking enabled) instead of Manifest's previous cost-saving override. To get the old behavior back, configure thinking explicitly per-model from the Routing page once the frontend ships. Migration backfills the existing per-tier config to every compatible route in the assignment (primary + fallbacks) so no per-model setting is silently lost. Adds new endpoints `GET/PUT/DELETE /api/v1/routing/:agent/model-params` for the upcoming frontend.
