---
"manifest": patch
---

Harden provider connection attribution and analytics before release. A subscription a user removed is no longer silently brought back by an agent's background re-registration. Pre-upgrade message history now attributes to the right connection for users who had the same provider on multiple agents. The dashboard overview keeps Playground traffic out of every card and chart consistently, and the provider-key cache is no longer bypassed on the proxy path.
