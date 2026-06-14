---
"manifest": patch
---

Close a cross-tenant read path in message-detail logs (the llm_calls/agent_logs/tool_executions child queries are now tenant-scoped), and harden dashboard reliability: reject API keys past their own expiry from the auth cache, stop reporting routing-override saves that didn't persist, keep a demo-seed failure from aborting boot, and add a retryable error state to the connection page.
