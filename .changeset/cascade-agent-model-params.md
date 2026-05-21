---
"manifest": patch
---

Add an ON DELETE CASCADE foreign key from agent_model_params to agents so saved model parameters are cleaned up when an agent is hard-deleted, preventing orphaned rows.
