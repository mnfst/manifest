---
"manifest": patch
---

Drop 4 unused composite indexes on write-only OTLP ingestion tables (tool_executions, token_usage_snapshots, cost_snapshots, agent_logs) to reduce write amplification
