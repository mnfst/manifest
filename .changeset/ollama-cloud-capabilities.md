---
'manifest': patch
---

Report modalities and capability flags for Ollama Cloud models. `ollama-cloud` was missing from the models.dev provider map, so every lookup missed and `GET /v1/models?capabilities=true` returned no `input_modalities`, `output_modalities`, or `features` for those models. Release tags that models.dev omits from its key (`:preview`, `:0813`) now fall back to the base model.
