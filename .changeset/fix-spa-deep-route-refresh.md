---
manifest: patch
---

Fix SPA deep-route refresh returning 404 in local/embedded mode by disabling @nestjs/serve-static's broken render handler and hardening the SPA fallback filter to use cached index.html content instead of res.sendFile()
