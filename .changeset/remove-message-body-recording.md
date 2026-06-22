---
"manifest": minor
---

Stop storing full message request/response bodies. The Messages page keeps the per-message metadata view (status, model, provider, tokens, cost, routing, request headers, model parameters) but the recorded-body drawer is removed. A migration drops the `message_recordings` table and the unused `llm_calls` / `tool_executions` / `agent_logs` tables, significantly reducing database storage.
