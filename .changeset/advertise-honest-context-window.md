---
"manifest": minor
---

Advertise an honest context window for `manifest/auto` via a new OpenAI-compatible `GET /v1/models` endpoint. The `context_length` returned is the minimum across every model the agent could be routed to (tier primaries, fallbacks, specificity overrides) — any routed model is guaranteed to accept at least that many tokens, so clients that compact against this value stop overflowing the routed model. Adds a per-agent **Context window** card in Settings to override the computed floor, and a helper endpoint `GET /api/v1/routing/:agentName/context-window` for the dashboard. Addresses #1617, #1612, and #1450.
