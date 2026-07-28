---
"manifest": patch
---

Self-hosting fixes. The install script now resumes instead of failing when the install directory already exists, so a run that died at `docker compose up` can be retried without losing the generated secret. Adds `--port` for installing on a port other than 2099, and generates `MANIFEST_ENCRYPTION_KEY` so provider credentials are no longer encrypted with the session-signing secret by default. The bundled compose file now forwards 16 documented variables it was silently dropping, including `TELEMETRY_ENDPOINT` and `MANIFEST_DISABLE_HSTS`. Blank values for `TELEMETRY_ENDPOINT` and the provider OAuth client IDs fall back to their defaults instead of being treated as an override.
