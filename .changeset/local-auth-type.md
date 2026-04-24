---
'manifest': minor
---

Surface local models (Ollama, LM Studio) as their own provider category. New `auth_type: 'local'` joins `api_key` and `subscription`; messages routed to local runners now carry a grey house badge in the message log, routing cards, and cost-by-model table. The Add Provider modal gets a third **Local** tab that appears only on self-hosted installs. Backfill migrations re-tag existing Ollama/LM Studio `user_providers` rows, and custom providers whose display name resolves to a canonical local runner are tagged `local` at insert time. Connecting/disconnecting a local provider works like the Subscription tab — click-to-disconnect flips the toggle and stops routing to it.
