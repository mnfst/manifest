---
'manifest': minor
---

Make complexity routing optional. New agents now default to a single "Default" tier that handles every request — pick one model and you're routing. Complexity routing (four tiers scored by request content) becomes an opt-in toggle on the Routing page alongside the existing task-specific routing. Existing agents keep complexity routing on with their tier picks preserved.
