---
'manifest': patch
---

Track real per-request cost for OpenCode Go subscriptions. The OpenCode Go plan is a dollar quota ($12 / 5h) consumed per request, not a flat fee, so each call now records its docs-attributed USD cost (e.g. `$12 / 880 = $0.013636` for GLM-5.1) instead of `$0.00`. Other subscription providers (Claude Max, ChatGPT Plus, GLM Coding, Copilot) continue to record `$0.00`.
