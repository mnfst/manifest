---
"manifest": patch
---

Stop slow startup model-catalog syncs from stalling boot past the deploy healthcheck. The OpenRouter, models.dev, GitHub, and modelparameters.dev fetches now run in the background instead of blocking `app.listen()`, and the two that lacked a timeout (OpenRouter, GitHub) now abort after 10s. The pricing cache still warms up with real data once those fetches land.
