---
"manifest": patch
---

Give repeated tool call ids unique values when converting a Chat Completions request to Responses, so reused ids no longer trip a strict Responses provider's "Duplicate function_call_output for call_id".
