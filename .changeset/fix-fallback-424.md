---
"manifest": patch
---

fix: treat upstream HTTP 424 as retriable so the fallback chain is attempted

Previously, HTTP 424 was reused as an internal sentinel for "all fallbacks exhausted," which meant a real 424 from an upstream provider would skip the fallback chain entirely. The sentinel is now removed — the system relies on the existing `X-Manifest-Fallback-Exhausted` header and `fallback_exhausted` error type instead, and the rebuilt response preserves the primary provider's actual HTTP status.
