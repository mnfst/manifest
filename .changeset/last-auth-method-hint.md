---
"manifest": patch
---

Show a small "Last used" badge on the sign-in and sign-up pages so returning visitors can see at a glance which method (email or one of the social providers) they used last time. The hint is stored per-browser in `localStorage` and is best-effort: it falls back silently when storage is unavailable.
