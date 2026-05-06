---
"manifest": minor
---

Add an Anthropic Messages-compatible endpoint at `POST /v1/messages`. Anthropic SDK clients (Claude Code, `@anthropic-ai/sdk`) can now point `ANTHROPIC_BASE_URL` at a Manifest gateway and route through Manifest's tier/specificity pipeline like any OpenAI client. The implementation translates Anthropic Messages requests into the internal chat-completions form (and back on the response side), reusing the existing routing, scoring, fallback, and recording machinery.
