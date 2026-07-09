---
'manifest': minor
---

Add Stripe billing (cloud only). Free plan request quota comes from shared plan limits. Pro price is read from the configured Stripe Price ID and includes unlimited requests. Free request limits are enforced on the proxy; over-limit requests return a 402 with an upgrade prompt. Self-hosted stays unlimited.
