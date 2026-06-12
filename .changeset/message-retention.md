---
"manifest": minor
---

Add configurable message log retention under Settings > Data retention. Pick `7`, `30`, `90`, or `180` days, or keep `forever` (default). An hourly cron purges `agent_messages` older than the configured horizon. Stored as a global `message_retention_days` column on `install_metadata`; existing installs default to `forever` so behavior is unchanged unless the setting is touched.
