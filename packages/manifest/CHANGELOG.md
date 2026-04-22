# manifest

## 5.49.0

### Minor Changes

- 59bb203: New Docker installs get port **2099** (a nod to the peacock logo) by default. Existing installs keep their current port — no action required on upgrade.

  ### How backward compatibility is preserved
  - The backend's own fallback stays at `3001` (it's `process.env.PORT ?? 3001` everywhere).
  - The Docker Compose file now sets `PORT=${PORT:-2099}` explicitly. New installs from `install.sh` get 2099 end-to-end: backend listens on 2099, compose binds `127.0.0.1:2099:2099`, and `BETTER_AUTH_URL` defaults to `http://localhost:2099`.
  - Existing installs that pull the new image against their unchanged compose file continue to work: no `PORT` env, so the backend falls back to 3001, their old `127.0.0.1:3001:3001` binding still matches, and their `BETTER_AUTH_URL` / reverse proxy / OAuth callbacks all keep working.
  - If a user wants to upgrade their compose file but keep port 3001 (e.g., to avoid reconfiguring OAuth callbacks), they set `PORT=3001` in `.env` and the compose file honours it — both the host binding and the internal listener now read `${PORT:-2099}`.
  - The Dockerfile `HEALTHCHECK` reads `process.env.PORT || 3001` at runtime so it follows whatever port the backend is actually listening on, regardless of which image-version pairs with which compose file.

  ### Install script UX (closes #1643)
  - Default install directory is now `$HOME/manifest` (was `./manifest`), so the one-liner from `install.sh` no longer litters whatever directory you happened to run it in.
  - The confirmation prompt reads from `/dev/tty` when stdin is not a terminal (typical when piping `curl | bash` or running via `bash <(curl ...)`). If there is no terminal at all, the script exits with a clear message pointing at `--yes`.
  - Detects port conflicts up front: if `2099` is already bound, the installer aborts with a pointer to edit `docker-compose.yml`, instead of letting `docker compose up` fail with a less obvious message.
  - Copy fix: "up to a couple of minutes" instead of "about 30 seconds" (the installer itself waits up to 120s).
  - Prints a `curl -sSf http://localhost:2099/api/v1/health` smoke-test line alongside the dashboard URL on success.
  - README now documents `--dir`, `--yes`, `--dry-run` and shows the review-then-run idiom for security-cautious users.

  ### Housekeeping
  - Rename `packages/backend/src/common/utils/sql-dialect.ts` → `postgres-sql.ts`. The file only emits Postgres SQL (no dialect switching), so the old name was misleading. 20 import sites updated.

## 5.48.0

### Minor Changes

- b41c0a2: Connect the Dockerized self-hosted version to local LLM servers on the host. The bundled `--profile ollama` service is gone; the Manifest container now reaches host-installed Ollama, vLLM, LM Studio, llama.cpp, text-generation-webui, and any OpenAI-compatible server at `host.docker.internal:<port>` via a `host-gateway` alias. Custom providers accept `http://` and private/loopback URLs in the self-hosted version (cloud metadata endpoints stay blocked). Adds preset chips for local servers and a server-side `/v1/models` probe that auto-populates the model list. Renames the deployment concept from "local" to "self-hosted" across the codebase (`MANIFEST_MODE=selfhosted`, `isSelfHosted()`); `MANIFEST_MODE=local` is still honored as a legacy alias.
- 7de07d2: Capture incoming request headers on every proxied chat completion and surface them in the message detail drawer, with a new App/SDK meta row sourced from the existing caller attribution. Sensitive headers (authorization, cookie, proxy-authorization, x-api-key) are stripped before storage, and the Request Headers section is collapsed by default.
- 30adc95: Fix web_browsing false positives that misrouted coding sessions. Pruned generic web-dev vocabulary (html, dom, url, http, link, page) from the webBrowsing keyword list, added weighted scoring, URL detection, code-fence/file-path signals, session stickiness across recent turns, a confidence gate, and a "Wrong category?" feedback control in the Messages log that dampens repeatedly-miscategorized categories.

### Patch Changes

- 2051a74: Code quality audit cleanup across backend, frontend, and shared packages:
  - Consolidate the provider registry into a single source of truth at `packages/shared/src/providers.ts` that the backend `PROVIDER_REGISTRY` and frontend `PROVIDERS` both consume, eliminating drift.
  - Drop the vestigial `DbDialect` / `detectDialect` / `portableSql` helpers and the `_dialect` parameter threaded through seven services; Manifest has been Postgres-only for some time.
  - Port `NotificationRulesService` off raw `DataSource.query()` onto TypeORM repositories + QueryBuilder.
  - Remove the unused `TokenUsageSnapshot` / `CostSnapshot` entities (tables remain; no data migration).
  - Extract scattered `if (provider === 'xai' | 'copilot' | ...)` branches into data-driven hooks (`provider-hooks.ts`).
  - Split `scoring/keywords.ts` (949 lines) into one file per specificity category under `scoring/keywords/`.
  - Split `ProxyService.proxyRequest`, `ProxyController.chatCompletions`, `MessagesQueryService.getMessages`, and `ProviderClient.forward` into focused helpers (all previously 130+ lines).
  - Consolidate the frontend API layer: `fetchMutate` now takes a path, and a `routingPath(agentName, suffix)` helper replaces 30+ duplicated `${BASE_URL}/routing/${encodeURIComponent(...)}` literals.
  - Add `recordSafely()` and `buildMessageRow()` helpers in the proxy write path to dedupe seven fire-and-forget `.catch(logger.warn)` blocks and five near-identical message inserts.
  - Remove the deprecated `subscriptionOAuth` flag (use `subscriptionAuthMode === 'popup_oauth'`).
  - Drop the identity `sql()` wrapper in `EmailProviderConfigService` and helpers.

- 4599c47: Shrink the Docker image by switching the runtime stage to distroless Node 22 (`gcr.io/distroless/nodejs22-debian12:nonroot`):
  - Runtime drops the shell, `apk`, and the unused yarn toolchain that `node:22-alpine` bakes in.
  - Production dependencies are now staged on `node:22-slim` so glibc matches the distroless debian12 runtime (all runtime deps are pure JS).
  - Prune `sql.js` from the runtime node_modules — it's an optional TypeORM peer only used by the legacy SQLite local mode, which is never active in Docker.
  - Add `--prefer-offline --no-audit --no-fund` to all npm installs, and pin the two new base images by digest.
  - Result: `423MB → 362MB` on disk (−14.4%), `84.2MB → 71.9MB` compressed pull (−14.6%).

- d5b23dc: Fix custom providers mangling upstream model IDs that contain `/` characters (#1591, #1615). Multi-segment model names like `MiniMaxAI/MiniMax-2.7` or `accounts/fireworks/routers/kimi-k2p5-turbo` are now forwarded to the upstream API unchanged instead of having a legitimate slash segment stripped.
- bb3dc29: Retire residual SQLite / sql.js / "local mode" references left behind after the local-mode path was removed:
  - Drop the dead `isLocal()` branch in `RoutingInstructionModal` (the `/api/v1/health` endpoint never returns `mode`, so the branch was unreachable) and the test that faked a `mode: "local"` health response to exercise it.
  - Tighten the frontend `NotificationRule.is_active` type from `boolean | number` to `boolean`, and drop the `typeof === 'number' ? !!x : x` coercion in `Limits.tsx` and `LimitRuleTable.tsx` (the integer boolean was a SQLite-era shape; the backend returns real booleans).
  - Remove the dead `connection: { options: { type: 'sqlite' } }` mock in `proxy.controller.spec.ts` — no production code reads `ds.connection.options.type`.
  - Remove the stale `vi.mock("../../src/services/local-mode.js", ...)` in `ProviderSelectModal-opencode-go.test.tsx` (module was deleted long ago).
  - Refresh the `packages/backend/src/common/utils/sql-dialect.ts` header (no dialect switching happens — the file is Postgres-only).
  - Fix comment/test-description rot: "dialect" wording in `query-helpers.ts` + spec, "local mode" in `Sidebar.test.tsx` / `session.guard.spec.ts` / `proxy-rate-limiter.ts`, "PG & sql.js" in `costs.e2e-spec.ts`.
  - Update `CLAUDE.md`: drop references to deleted files (`local-bootstrap.service.ts`, `local-mode.ts`, `LocalAuthGuard`), drop the `MANIFEST_DB_PATH` / `MANIFEST_UPDATE_CHECK_OPTOUT` env vars (no-ops per the v2.x breaking changes), drop the "Local mode database uses sql.js" architecture note, and correct the "Better Auth database" section (Postgres always).

  No behaviour change — all four test suites green (backend 4007, frontend 2267, e2e 123) and both packages typecheck clean.

## 5.47.2

### Patch Changes

- 135b9e3: Fix blank dashboard when exposing Manifest on a LAN IP over HTTP. Helmet's default CSP emitted `upgrade-insecure-requests`, which browsers enforce on private IPv4 ranges (10.x, 172.16-31.x, 192.168.x) but relax for localhost — so the JS bundle was rewritten to `https://` and silently failed to load, leaving an empty `<body>`. The directive is now disabled; HTTPS deployments should enforce upgrades via HSTS at the reverse proxy instead.

## 5.47.1

### Patch Changes

- b28f714: Docker hardening Phase 3 follow-ups: add a 64MB cap to the manifest container's `/tmp` tmpfs, raise `pids_limit` from 256 to 512, and switch the healthcheck from BusyBox `wget` to a `node -e fetch(...)` invocation that's guaranteed to exist in the runtime image. Narrow the Dockerfile's `node_modules` `*.md` cleanup to `README*` only so packages that read nested markdown at runtime (e.g. `js-yaml` schema docs) keep working. Gate `/api/v1/public/{usage,free-models,provider-tokens}` behind `MANIFEST_PUBLIC_STATS=true` (default off, returns 404) so self-hosted instances don't leak aggregate stats to unauthenticated callers. Detect non-chat callers in the proxy exception filter and the `chat/completions` catch block via `body.stream === true` / `Accept: text/event-stream`; non-chat clients now receive real `401`/`400`/`500` HTTP statuses with a structured error envelope while chat UIs continue to get the friendly HTTP-200 envelope. Rewrite `og:url` / `og:image` in the SPA's `index.html` from `BETTER_AUTH_URL` at boot so self-hosters' shared link previews show their own URL instead of `app.manifest.build`. Add a `status` query parameter to `/api/v1/messages` (`ok`, `error`, `rate_limited`, `fallback_error`, or `errors` for the union of the three error variants) so the dashboard can offer an "errors only" toggle. Add `.github/workflows/docker-smoke.yml` that boots the production compose stack with `read_only: true`, waits for `/api/v1/health`, and tears down — guards against future code that silently writes to disk.
- b9011ae: Fix deleted custom providers continuing to intercept every request (#1603). Specificity routing now validates that an override model is still available before using it, and deleting a custom provider now also clears orphan references in specificity assignments and fallback-model lists. A one-time migration cleans existing orphaned references from the database so previously affected agents recover automatically.

## 5.47.0

### Minor Changes

- 2493d97: feat: add OpenCode Go as a subscription provider with dynamic model discovery

  OpenCode Go is a low-cost subscription that exposes GLM, Kimi, MiMo, and MiniMax
  models through a unified API. Users sign in at opencode.ai/auth, copy their API
  key, and paste it into the OpenCode Go detail view in the routing UI. The backend
  routes GLM/Kimi/MiMo models through the OpenAI-compatible endpoint and MiniMax
  models through the Anthropic-compatible endpoint — both served from the same
  `https://opencode.ai/zen/go` base URL. The Anthropic endpoint authenticates via
  `x-api-key` (not Bearer), matching the native Anthropic wire protocol.

  The model list is fetched dynamically from the public OpenCode Go docs source
  and cached in memory for one hour, with a last-known-good fallback on fetch
  failures. No hardcoded model list in the codebase.

- 313a332: Add per-message feedback (thumbs up/down) to Messages and Overview pages

### Patch Changes

- 4dda346: Filter internal Azure routing models from GitHub Copilot provider

## 5.46.7

### Patch Changes

- aeb7a54: fix(proxy): capture streaming token usage for Ollama and Ollama Cloud providers

## 5.46.6

### Patch Changes

- 83afc73: fix(docker): auto-detect local mode in Docker containers via /.dockerenv
- 83afc73: fix: show email verification prompt after signup instead of silently reloading

## 5.46.5

### Patch Changes

- 19a1366: Improve local/Docker mode: hide social login buttons when OAuth is not configured, fix per-user data isolation, add optional Ollama via Docker Compose profile, and expose mode/Ollama status in setup endpoint.

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
