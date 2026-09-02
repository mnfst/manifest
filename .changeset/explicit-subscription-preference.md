---
'manifest': patch
---

Route an explicit bare model id to the subscription connection when both a subscription and an api_key connection of the same provider serve it, instead of silently metering the key.
