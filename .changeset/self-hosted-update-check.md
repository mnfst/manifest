---
'manifest': minor
---

Add `GET /api/v1/version` for self-hosted installs: reports the running version, the latest GitHub release, and changelog/upgrade links so the dashboard can show a "new version available" badge. Checks once a day, never in cloud mode, and can be turned off with `MANIFEST_UPDATE_CHECK_DISABLED=1`.
