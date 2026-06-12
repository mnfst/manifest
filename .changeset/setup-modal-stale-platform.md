---
'manifest': patch
---

Fix the post-create "Set up harness" modal showing the full harness picker instead of the harness you just chose. AgentGuard now refetches the agent list when the viewed agent changes, so a newly created agent's platform reaches the setup modal (previously the stale, source-less list left the platform unset whenever the agent was created from the always-present sidebar while another agent was open).
