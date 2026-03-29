---
"manifest": minor
---

Add models.dev as primary pricing source for model discovery

- New ModelsDevSyncService fetches curated model data from models.dev/api.json
- models.dev uses native provider model IDs (no normalization needed)
- Enrichment priority: models.dev first, OpenRouter fallback
- Smart lookupModel with 7 fallback strategies for variant model names
- Capability flags (reasoning, toolCall) flow from models.dev to quality scoring
- OpenAI max_tokens → max_completion_tokens conversion for GPT-5+/o-series
- Filter non-chat models from OpenAI (embed, TTS, sora, codex) and Mistral (OCR)
- Gemini alias/versioned model deduplication
- Price=0 subscription models no longer overwritten by enrichment
