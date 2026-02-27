---
"manifest": patch
---

Fix OpenRouter sync misattributing non-native models to providers. The sync now defers to the curated seeder for native provider assignments — existing models get pricing updates only (provider preserved), while new discoveries are added as OpenRouter-only entries.
