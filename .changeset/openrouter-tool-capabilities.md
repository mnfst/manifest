---
'manifest': patch
---

Report tool support and modalities for OpenRouter models. OpenRouter reached neither models.dev provider map, so all 323 published models declared only `stream` and never `tools`, and anything reasoning about capability — the dashboard picker, `/v1/models?capabilities=true`, agents choosing a remap target — treated every one of them as tool-incapable. OpenRouter now sits in the capability-only map, so its rates stay with its own live `/models` feed while models.dev supplies the modalities and tool-call flags that feed omits. Routing variants (`:free`, `:nitro`, `:batch`) resolve to their base model's capabilities.
