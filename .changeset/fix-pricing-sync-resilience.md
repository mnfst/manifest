---
"manifest": patch
---

Fix Model Prices page showing only 31 models: add error handling in OpenRouter sync loop so one bad model doesn't crash the entire sync, trigger sync on startup when data is stale, and always upsert curated seed models on restart
