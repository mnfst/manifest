---
---

Internal: extract a shared `RedirectPkceOauthBaseService` from the OpenAI
OAuth service so future redirect-PKCE providers reuse the loopback
callback server, PKCE state, token exchange/refresh, and revoke logic.
No behavior change.
