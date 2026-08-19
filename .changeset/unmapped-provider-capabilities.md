---
'manifest': patch
---

Report modalities and capability flags for Kilo, Pioneer, Cline Pass and Xiaomi models. These providers publish no modality data on their own `/models` endpoints and are not mapped in `PROVIDER_ID_MAP`, so `GET /v1/models?capabilities=true` returned nothing for them. Capability lookups now fall back to the models.dev provider catalog. Pricing is unaffected: it still comes from the connection's own provider.
