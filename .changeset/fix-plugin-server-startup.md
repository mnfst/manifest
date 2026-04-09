---
"manifest": patch
---

fix: start embedded server eagerly instead of deferring to OpenClaw callback

The plugin previously only registered a deferred `start()` callback via
`api.registerService()`, relying on OpenClaw to invoke it. Newer OpenClaw
versions may not invoke the callback, causing the server to never bind.

Now the server starts eagerly during `register()`, with the existing
`checkExistingServer()` health-check guard preventing double-starts if
OpenClaw also calls the callback.

The dashboard banner is now only logged after the server is confirmed
running via health check, instead of prematurely during registration.

Closes #1472, closes #1474.
