---
"manifest": patch
---

Give repeated tool call ids unique values before forwarding a Responses history, so strict Responses providers stop rejecting resubmitted turns with "Duplicate function_call_output for call_id".
