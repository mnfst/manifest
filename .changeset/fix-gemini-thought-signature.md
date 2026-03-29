---
"manifest": patch
---

Fix Google Gemini proxy failing with "missing thought_signature" error on newer models (e.g. Gemini 3 Flash Preview) by preserving the thought_signature field through the OpenAI-compatible format conversion round-trip.
