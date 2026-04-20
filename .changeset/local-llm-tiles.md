---
'manifest': minor
---

Promote vLLM, LM Studio, and llama.cpp to first-class provider tiles alongside Ollama. In the self-hosted version the four local-LLM tiles render with official logos; clicking one opens the custom-provider form prefilled with `http://{localLlmHost}:<default-port>/v1` so the user just clicks "Fetch models" and "Connect". Cloud mode hides all four tiles (the cloud backend can't reach the user's host anyway).
