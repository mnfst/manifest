---
'manifest': minor
---

Add a per-auth-type breakdown to the public `provider-tokens` endpoint. Each provider now carries an `auth_types` array (`{ auth_type, total_tokens, model_count }`) alongside the existing `models` list, so a provider that is used both with an API key and a subscription (e.g. OpenAI API key vs ChatGPT subscription) can be listed once per auth method. Usage with no recorded auth type is counted as `api_key`. The existing `provider`/`total_tokens`/`models` fields are unchanged, so the addition is backwards compatible.
