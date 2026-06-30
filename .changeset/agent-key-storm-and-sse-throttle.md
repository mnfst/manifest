---
"manifest": patch
---

Stop a wrong or revoked agent key from hammering the database and flooding the logs. Every request bearing a bad `mnfst_` key used to run a fresh indexed DB lookup and emit a warning, so one misconfigured agent in a retry loop sustained DB load and log noise indefinitely. Rejected keys are now cached for 30s (cleared the moment a key is created or rotated), collapsing a storm to one lookup and one log line per window. Separately, the dashboard live-update stream (`/api/v1/events`) no longer counts against the global rate limiter, so heavy dashboard use can't trip a 429 that severs the stream.
