---
"manifest": patch
---

Fix plugin hooks not firing on current gateways by using api.on() instead of api.registerHook(), add backwards-compatible handler/execute and name/label fields for tools and provider registration
