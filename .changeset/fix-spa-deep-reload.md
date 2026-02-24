---
"manifest": patch
---

Fix SPA deep-page reload returning 404 in local/production mode by adding a NotFoundException filter that serves index.html for non-API GET requests
