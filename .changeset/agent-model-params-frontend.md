---
'manifest': minor
---

Routing UI: every model row (primary chip, fallback row, header-tier primary, header-tier fallback) now exposes the per-model Parameters affordance for any provider whose API consumes a known knob (today: DeepSeek's `thinking`). Settings travel with the model identity wherever it appears — saving DeepSeek's thinking mode on one slot updates every other slot showing the same model. Closes the long-standing gap on the "custom" (header-tier) routing surface, which previously had no params support at all. Wires the new `GET/PUT/DELETE /api/v1/routing/:agent/model-params` endpoints shipped in the backend PR.
