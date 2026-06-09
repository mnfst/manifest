---
'manifest': patch
---

Make Anthropic Claude Code subscription OAuth and routing match the Claude Code flow: exchange tokens through the Claude Code API host, avoid connect-time probes, and use Claude Code-compatible request headers. Also fix Anthropic OAuth pending-flow consumption so the saved provider keeps the correct agent and user IDs.
