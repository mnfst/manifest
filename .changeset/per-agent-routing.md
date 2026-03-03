---
"manifest": minor
---

Make routing configuration per-agent instead of per-user. Each agent now has its own independent set of provider connections (with encrypted API keys) and tier-to-model assignments. Dashboard routing API endpoints include the agent name in the URL path. Existing user-level routing configuration is automatically migrated to all agents under each user.
