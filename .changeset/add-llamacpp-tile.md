---
"manifest": patch
---

Add a llama.cpp provider tile to the API Keys tab in the self-hosted version. Clicking it probes `http://localhost:8080/v1/models` on the default llama-server port, lists every model the server exposes, and lets you connect them in one click. Pre-b3800 llama.cpp builds that don't expose `/v1/models` get a hint to upgrade or fall back to the custom-provider form. Messages and dashboard filters render llama.cpp and LM Studio as first-class providers instead of opaque `custom:<uuid>` rows.
