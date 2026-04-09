---
"manifest": minor
---

feat: add specificity routing — optional task-type-based routing that overrides complexity tiers

Users can now activate specificity routing for coding, web browsing, and data analysis tasks.
When active, requests matching a specificity category are routed to the user's chosen model
regardless of complexity tier. Detection uses keyword analysis and tool name heuristics,
with an optional `x-manifest-specificity` header for explicit overrides.
