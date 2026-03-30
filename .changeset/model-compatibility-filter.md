---
"manifest": minor
---

Add universal non-chat model filter, tool support filter, and thought signature cache

- Filter non-chat models (TTS, embedding, image-gen) across all providers at discovery time
- Filter models without tool calling support when models.dev confirms toolCall: false
- Prefer tool-capable models in tier auto-assignment for standard/complex/reasoning tiers
- Relax output modality check from "text-only" to "includes text" for multimodal models
- Add ThoughtSignatureCache to re-inject thought_signature values stripped by clients during Google Gemini round-trips
