---
"manifest": patch
---

Fix PostHog funnel distinct_id mismatch in cloud mode by emitting plugin_registered from backend with hashed user ID, and pass explicit mode to plugin telemetry events
