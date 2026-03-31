---
"manifest": patch
---

fix: unlock sonnet/opus for Anthropic subscription tokens

Anthropic's subscription OAuth API requires a Claude Code agent identity system prompt to access sonnet and opus model families. Without it, only haiku is accessible. This injects the required system prompt for subscription auth, matching how we already spoof Editor-Version headers for GitHub Copilot.
