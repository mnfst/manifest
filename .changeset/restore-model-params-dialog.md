---
'manifest': patch
---

Restore the per-tier (and per-specificity) Model Parameters dialog that was inadvertently dropped during a stacked-PR merge. The sliders icon is back on every primary model chip in Routing for providers that consume known params (today: DeepSeek's `thinking` toggle). The dialog persists per-assignment, so a single configured value applies to the primary model AND every fallback the proxy tries — without per-route schema changes. Multi-key compatible: pinning a different key on the same route does not affect the stored params, and switching keys mid-flight keeps using whatever the proxy resolved for that iteration.

Adds back: `PATCH /api/v1/routing/:agent/tiers/:tier/params`, `…/specificity/:category/params`, `TierService.setParamDefaults`, `SpecificityService.setParamDefaults`, frontend `setTierParamDefaults` / `setSpecificityParamDefaults`, and `ModelParamsDialog`.
