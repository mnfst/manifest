---
"manifest": minor
---

Add full OAuth flow for the Anthropic Claude Pro / Max subscription. Connecting
your Claude subscription is now a one-click "Sign in with Claude" → paste the
authorization code, instead of running `claude setup-token` in a separate
terminal. Tokens auto-refresh through the same blob/refresh path used by OpenAI.

Internally the OAuth code in `routing/oauth/` was split into shared `core/`
primitives (PKCE, token-blob storage, pending-state TTL, callback HTML) plus
per-provider files. The OpenAI service now delegates to the same primitives,
and a new `oauth/anthropic/` package implements the paste-code flow.
