# manifest

## 5.46.4

### Patch Changes

- d6de5d5: Fix Hermes setup instructions to use top-level model section instead of custom_providers

## 5.46.3

### Patch Changes

- 71112c7: Fix dashboard Recent Messages showing the complexity tier (e.g. `STANDARD`) instead of the specificity category (e.g. `CODING`) for messages routed by specificity. The Overview analytics endpoint now projects `specificity_category` alongside `routing_tier`, matching the full Messages log.
- 97dbe29: Rewrite the `[🦚 Manifest] …` friendly error messages the proxy sends back as chat completions so they read less like a system alert and more like a note from a person. Em dashes are gone, "connected successfully" is gone, "this API key wasn't recognized" becomes "I don't recognize this key", limit messages lead with "You hit your ${metric} limit" instead of the clinical "Usage limit hit:", and the auth-header hint now tells users the exact `Bearer mnfst_<your-key>` format to paste. No behavioural change — same triggers, same URLs, same branching; just different copy.
- 43590ad: Route short greetings to the `simple` tier even when the agent attaches tools. The scorer's short-message fast path was gated on `!hasTools`, so personal AI agents like OpenClaw (which always send a `tools` array) skipped it entirely and fell into full scoring, where session momentum could pull a one-word `hi` up to `complex`. Dropping the gate lets short, non-technical prompts short-circuit to `simple` before momentum kicks in. Short technical prompts like `Debug this function` still fall through to full scoring.

## 5.46.2

### Patch Changes

- acd1f9c: Docker release hardening pass: parameterize POSTGRES_PASSWORD and wire `.env.example` through `install.sh`; bind port 3001 to `127.0.0.1` by default; drop stale `MANIFEST_TRUST_LAN` from docs; replace OpenClaw-specific meta tags in the SPA with agent-neutral copy. `/api/v1/routing/:agent/status` now returns a structured `{ enabled, reason }` shape and only claims `enabled: true` when at least one tier resolves to a real model (`reason: no_provider | no_routable_models | pricing_cache_empty`). Provider connect rejects unknown providers and normalises casing. Tier override rejects unknown models with a helpful list. New `GET /api/v1/routing/pricing-health` and `POST /api/v1/routing/pricing/refresh` endpoints plus a Routing-page banner when the OpenRouter pricing cache is empty. Workspace-card and per-agent message counts now exclude error and fallback-error rows.
- 68510a5: Fix the "check your dashboard" links that Manifest embeds in `[🦚 Manifest] …` friendly error messages returned by the OpenAI-compatible proxy. Auth errors (missing / empty / invalid / expired / unrecognized key) used to emit `${baseUrl}/routing`, which 404'd — that path does not exist in the frontend router. They now point at the Workspace landing page. Agent-scoped errors used to drop the user on the agent Overview page; they now deep-link to the section that actually fixes the problem — "No API key set for X" and "Manifest is connected successfully, connect a provider" go to `/agents/:name/routing`, and "Usage limit hit" goes to `/agents/:name/limits`.

## 5.46.1

### Patch Changes

- fc7890f: Remove local mode and harden the Docker deployment.

  Manifest now runs exclusively on PostgreSQL with Better Auth. The self-contained `manifest` OpenClaw plugin (embedded Nest server, SQLite via sql.js, loopback-trust auth) is deprecated and removed from the repository — it will receive no further releases. Self-hosted users should use the Docker image (`manifestdotbuild/manifest`) with the bundled Postgres container via `docker/docker-compose.yml`, or the cloud version at app.manifest.build.

  Docker deployments now default to `NODE_ENV=production`, with migrations controlled by a new `AUTO_MIGRATE=true` env var instead of the previous `NODE_ENV=development` workaround. Production-mode defaults activate: `trust proxy` for reverse-proxied deployments, sanitized upstream error messages, no "Dev" badge in the header, and email verification enforcement when a provider is configured. Self-hosters upgrading must set `BETTER_AUTH_SECRET` via `docker/.env` — the compose file no longer ships a placeholder secret.

  New unified `EMAIL_*` env var scheme (`EMAIL_PROVIDER`, `EMAIL_API_KEY`, `EMAIL_DOMAIN`, `EMAIL_FROM`) covers both Better Auth transactional emails (signup verification, password reset) and threshold alert notifications. Supports Resend (recommended for self-hosting — no domain setup), Mailgun, and SendGrid. Legacy `MAILGUN_*` env vars still work for backward compatibility.

  Breaking: `MANIFEST_MODE`, `MANIFEST_DB_PATH`, `MANIFEST_UPDATE_CHECK_OPTOUT`, `MANIFEST_TRUST_LAN` env vars are removed (no-op if set). Both the `manifest` and `manifest-model-router` npm packages are deprecated — OpenClaw users should configure Manifest as a generic OpenAI-compatible provider instead (see the setup modal in the dashboard).
