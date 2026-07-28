---
'manifest': patch
---

Preserve GPT-5.6 reasoning summaries on inbound Chat Completions: map the standard `reasoning_effort` param onto the Responses `reasoning` object (with `summary: auto`) for OpenAI endpoints so the model actually reasons, prefix-match Responses reasoning-summary delta events instead of an exact-name allowlist, and backfill `reasoning_content` from the terminal `response.completed`/`response.incomplete` output when no summary deltas streamed.
