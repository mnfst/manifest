---
"manifest": patch
---

Remove dead config settings: `captureContent`, `serviceName`, and `metricsIntervalMs`. These are now either hardcoded internally or computed per mode. Delete duplicate `src/openclaw.plugin.json`.
