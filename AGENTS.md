# Manifest Agent Guidelines

## Domain Terminology

Manifest terminology is directional:

- A **Manifest Request** is one logical request from an agent to Manifest. It lives in `requests`, has one caller-visible outcome, and may have zero or many attempts.
- A **Manifest Attempt** is one request from Manifest to an AI provider. It lives in `provider_attempts` and links to its Request through `provider_attempts.request_id`.
- The **Last Attempt** is the final provider attempt made for a Request. It is derived from the attempt chain; a zero-attempt Request has none. `requests.status` remains the authoritative Request outcome.
- A **Recovered Request** is a successful Request after a fallback or Auto-fix attempt. Recovery is a Request-only concept: an applied method that fails does not make the Request recovered.

Request-level analytics count `requests`; provider, connection, and model analytics count `provider_attempts`. Do not group Request totals by provider-level fields when a Request may span several Attempts.

See [`docs/analytics-glossary.md`](docs/analytics-glossary.md) for the complete glossary, database mapping, and counting rules.
