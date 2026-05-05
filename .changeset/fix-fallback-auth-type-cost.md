---
"manifest": patch
---

Fix fallback success rows recording the primary route's `auth_type` instead of the fallback's, which caused `cost_usd` to be miscomputed on mixed-auth chains (subscription fallbacks were charged, api_key fallbacks were stored as $0).
