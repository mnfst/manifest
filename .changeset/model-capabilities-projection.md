---
'manifest': minor
---

Expose structured model capability metadata (input/output modalities, endpoint features, supported endpoints) from `GET /v1/models?capabilities=true`, keeping the default response unchanged, resolved through the same pipeline as the routing model picker. Curated modality facts identify `gpt-5.3-codex-spark` as text-only input and mainline ChatGPT subscription models as image-capable in both the API and the picker.
