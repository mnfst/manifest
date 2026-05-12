---
'manifest': minor
---

Add `GET /api/v1/public/agent-tokens` public endpoint. Mirrors the shape of `/provider-tokens` but groups daily-token usage by `(agent_category, agent_platform)` instead of by LLM provider, so the marketing site can show per-agent (OpenClaw, Claude Code, OpenAI SDK, etc.) charts alongside the existing per-provider ones. Excludes the `other` platform bucket and `custom:*` models server-side. Gated by `MANIFEST_PUBLIC_STATS` and cached for 24h, same posture as the rest of the public-stats endpoints.
