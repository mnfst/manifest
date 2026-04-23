---
'manifest': minor
---

feat(providers): support Anthropic-compatible custom providers

Custom providers can now speak the Anthropic Messages API (`/v1/messages`) in addition to OpenAI's `/v1/chat/completions`. When adding a custom provider, pick the API format in the new segmented control on the form — Manifest's existing Anthropic adapter handles the translation so agents continue to call the OpenAI-compatible proxy unchanged. Useful for Azure's Anthropic endpoint and any other gateway that exposes the native Anthropic protocol.
