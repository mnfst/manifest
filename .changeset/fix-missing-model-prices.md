---
"manifest": patch
---

Fix missing model prices for 22 models across Mistral, Moonshot, Gemini, and OpenAI providers

- Filter non-chat models from discovery: gemini-robotics, gpt-5-search-api, mistral-vibe-cli
- Add -latest suffix stripping to pricing lookups in both models.dev and OpenRouter paths
- Add legacy Mistral name aliases: open-mistral-nemo to mistral-nemo, mistral-tiny to open-mistral-7b
- Add OpenRouter name aliases for provider API mismatches (voxtral-small to voxtral-small-24b)
- Add hardcoded fallback prices for moonshot-v1-* legacy models, gemma-3-1b-it, and gemini-pro-latest
