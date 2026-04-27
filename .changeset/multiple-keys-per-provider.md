---
"manifest": minor
---

Add support for multiple API keys per provider per agent. Users with several accounts for the same provider (a personal + work OpenAI key, two ChatGPT Plus subscriptions, two Anthropic Pro tokens) can attach all credentials and pin specific tiers or fallback rows to a specific labeled key. Multi-key applies to both `api_key` and `subscription` providers; local providers (Ollama, LM Studio) stay single-row since they don't carry credentials. Cap is 5 active keys per (agent, provider, auth_type). Single-key users see no UI change — the chip + "+ Add another key" affordance only appear once a provider has 2+ active keys.
