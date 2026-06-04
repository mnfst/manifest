---
"manifest": patch
---

Fix the Playground sending MiniMax subscription requests to the default region endpoint. The OAuth `resource_url` (which encodes the chosen region) was only applied for Gemini and dropped for MiniMax; it is now turned into a `minimax-subscription` base-URL override the same way the proxy does, so Playground requests hit the correct region. Follow-up to #2110 (cubic-flagged).
