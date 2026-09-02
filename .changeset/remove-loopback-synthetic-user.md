---
"manifest": patch
---
Remove the self-hosted loopback auto-login. Requests from 127.0.0.1 without a session are no longer treated as a signed-in local user.
