---
'manifest': patch
---

Inject cache_control prompt-caching breakpoints for Anthropic subscription OAuth requests. The skip dated from a misdiagnosed 400 that was actually caused by the missing Claude Code identity block, so subscription users were re-paying their full prompt prefix in quota on every request.
