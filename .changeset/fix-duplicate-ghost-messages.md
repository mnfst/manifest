---
"manifest": patch
---

Fix duplicate/ghost messages in dashboard

- Remove dummy seed data (seed-messages, demo security events, admin user)
- Record all proxy errors (not just 429/403/500+) so 400 errors show as Failed
- Fix ghost duplicate messages: unknown OTLP spans no longer create agent_messages
- Add timestamp-based dedup to prevent OTLP spans from duplicating proxy error records
