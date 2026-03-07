---
"manifest": patch
---

Add loading states to CRUD operations and backend performance improvements

- Add loading indicators to create agent, save/delete limit rules, remove email provider, and reset routing tiers to prevent double-submission
- Add database indexes on agent_messages, cost_snapshots, and security_event for faster queries
- Batch quality score updates and use upsert for custom provider pricing
- Store API key prefix at write time instead of decrypting at read time
