---
"manifest": minor
---

Add an opt-in public API that serves curated cross-tenant error-cluster pages for the marketing site. `GET /api/v1/public/error-pages[/:slug]` returns operator-approved clusters (gated by `MANIFEST_PUBLIC_STATS`), and a secret-guarded `POST/DELETE /api/v1/internal/error-pages` lets the Peacock CMS publish or pull pages. Only clusters seen by at least 10 distinct tenants are eligible, and every public sample is run through secret and email scrubbing before storage, so no single tenant's data or credentials can leak.
