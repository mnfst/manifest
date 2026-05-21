---
"manifest": patch
---

Performance: bound the public usage-stats aggregations, add a composite `(key_prefix, is_active)` index for agent-key auth lookups, reuse uPlot chart instances in place on data refresh instead of rebuilding them, and memoize the message log's feedback overrides.
