---
"manifest": minor
---

feat: add Ollama Cloud as a subscription provider for cloud-hosted model access

Users can now connect Ollama Cloud (https://ollama.com) alongside local Ollama. The
subscription tab accepts an API key pasted from ollama.com/settings/keys and lists
cloud-hosted models like DeepSeek, Qwen, Gemma, and Llama. Ollama Cloud is registered
as a separate provider from the existing local Ollama integration, so both can be
active on the same agent without conflict.
