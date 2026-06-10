---
"manifest": patch
---

Lazy-load `better-auth/node` inside `SessionGuard` to avoid ESM-only require errors when running in a CommonJS environment.
