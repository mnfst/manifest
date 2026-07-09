---
'manifest': patch
---

Open the HTTP port at boot instead of waiting for the provider model registry to load, so a slow database no longer stalls deploy healthchecks.
