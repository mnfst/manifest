---
"manifest": patch
---

Preserve provider `label` and `priority` when duplicating agents so copied providers no longer fail database inserts on self-hosted PostgreSQL schemas that require non-null labels.
