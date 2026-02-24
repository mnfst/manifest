---
"manifest": patch
---

Remove fs imports and direct process.env access from backend files that get copied into the plugin dist, eliminating false-positive security scanner warnings about credential harvesting.
