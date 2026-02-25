---
"manifest": minor
---

Add Ollama provider support and plugin dev mode

- Ollama integration: auto-sync local models, quality scoring for free models, proxy forwarding to local Ollama instance
- Plugin dev mode: connect to an external dev server without API key management
- OTLP loopback bypass: trust loopback connections in local mode without Bearer token
- Provider icons: show provider logo before model names in message tables with hover tooltip
- Increase provider timeout to 600s to support local model inference on CPU
- Reorder provider list: Ollama first, then by popularity
