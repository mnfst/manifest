---
'manifest': minor
---

Let custom routing tiers expose stable `manifest/<alias>` model IDs. Model aliases are available through `/v1/models`, work across all proxy APIs, outrank conflicting header rules, and fail with `M302` instead of falling through when unavailable.
