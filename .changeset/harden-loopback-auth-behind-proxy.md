---
"manifest": patch
---

Harden loopback auth: the self-hosted dashboard shortcut and the dev-mode ingest shortcut no longer trust requests that arrive through a reverse proxy (any `X-Forwarded-For` / `X-Real-IP` / `Forwarded` header), so a same-host proxy can't expose them to remote callers. The API also rejects unexpected fields in request bodies instead of silently dropping them.
