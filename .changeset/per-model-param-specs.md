---
"manifest": patch
---

Fetch model parameter specs per-model on demand instead of downloading the full MPS catalog on every Routing-page load, and add an ETag conditional GET to the catalog refresh. Keeps the dashboard payload flat as the catalog grows.
