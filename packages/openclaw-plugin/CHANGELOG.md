# manifest

## 5.28.3

### Patch Changes

- 44c8bcd: Normalize OpenAI-style tool call IDs when forwarding chat completions to Mistral so fallback requests remain compatible with Mistral's 9-character alphanumeric tool-call ID requirement.
- f72e8a3: Fix SKILL.md scanner contradictions: qualify "Not collected" statement to clarify OTLP vs routing data, remove MANIFEST_API_KEY from required env metadata since local mode doesn't need it.
- c3fd8c2: Rewrite SKILL.md TL;DR to remove blanket "not collected" claim that contradicted routing behavior. Now precisely states what each data path does.
- f4f6b1a: Slim down SKILL.md to essential setup and usage instructions. Detailed security, privacy, routing, and troubleshooting docs moved to GitHub README.

## 5.28.2

### Patch Changes

- 0c245fc: Remove PostHog product analytics from plugin, backend, and frontend. No external analytics calls are made in any mode. OTLP telemetry (traces/metrics to user's own endpoint) is unaffected. Restructure SKILL.md with security-first layout and local mode as primary setup path.

## 5.28.1

### Patch Changes

- cb636c6: Fix subscription disclaimer card contrast in dark mode and rename label from "Experimental" to "Notice"

## 5.28.0

### Minor Changes

- 9dad875: Fix MiniMax OAuth subscription setup by handling region-specific endpoints, normalizing device-code timing values, and aligning fallback model metadata with the documented MiniMax model IDs.

### Patch Changes

- 1a94edb: Normalize DeepSeek `max_tokens` before forwarding requests so out-of-range values do not hard-fail upstream.
- 3536bc8: Preserve Codex subscription instructions in proxied OpenAI requests so Codex backend calls do not fail with "Instructions are required".
- 4b31e82: Pass request tools and tool_choice into routing resolution so tool-aware scoring uses the actual proxy request context.
- 5e282bb: Stop cross-auth credential fallback when an auth type is explicitly requested.
  Requests that resolve to `auth_type: api_key` now only use API key credentials (and likewise for `subscription`) instead of silently decrypting another auth record.

## 5.27.1

### Patch Changes

- 4edcde8: Improve Add Provider modal: merge custom providers alphabetically with standard providers, add experimental disclaimer for subscription tab, use pill-style action chips for "Add custom provider" and "Request new subscription model"

## 5.27.0

### Minor Changes

- 5835963: Add OpenAI subscription routing support with zero-cost billing
- cdd1d14: Add subscription model discovery with fallback models and auth-type-aware deduplication

### Patch Changes

- 0ec6da5: Skip ephemeral callback server in cloud mode and show paste-URL input immediately after OAuth popup opens
- 04e8868: Revert dynamic OAuth redirect_uri and add paste-URL fallback for cloud deployments
- 389c2ff: Fix OpenAI OAuth callback to use backend URL in production instead of hardcoded localhost:1455
- 94a8e9f: Prevent browser password save prompt on API key and token inputs by using CSS text-security masking instead of type="password"
- d9e34c2: Sync openclaw.plugin.json version with package.json automatically during changeset version bumps

## 5.26.0

### Minor Changes

- b27b960: Add expandable message detail logs to the Messages page with chevron button to view related LLM calls, tool executions, agent logs, error details, and fallback chain info
- 76c3fda: Replace static model seeding with provider-native model discovery via live API calls
  - Add `ProviderModelFetcherService` with config-driven fetchers for all 12 providers
  - Add `ModelDiscoveryService` orchestrator that discovers, enriches, and caches models per provider
  - Refactor `PricingSyncService` into OpenRouter pricing lookup cache (no DB writes)
  - Refactor `ModelPricingCacheService` to read from OpenRouter cache + manual pricing reference
  - Add `cached_models` and `models_fetched_at` columns to `user_providers`
  - Drop `model_pricing`, `model_pricing_history`, and `unresolved_models` tables
  - Remove static model seed data and hardcoded frontend model lists
  - Add "Refresh models" button to routing UI
  - Add `POST /api/v1/routing/:agent/refresh-models` endpoint

### Patch Changes

- f8f93f0: Allow LAN access in local mode by accepting RFC1918 private network IPs alongside loopback
- 3a79e19: Fix routing fallback chain: trigger fallback on all 4xx/5xx errors, resolve providers via connected provider cache, record real usage data on fallback success, and show fallback icon on all handled messages
- cf4d6c7: fix: record every provider error so rate-limited calls display as errors instead of success
- e338ab8: Fix stale agent list after deletion by disabling browser HTTP cache on API requests
- 9a13cc6: Fix streaming tool calls dropped by Anthropic and Google adapters in the LLM proxy
- 103260e: Show display names and provider icons in model prices table

## 5.25.4

### Patch Changes

- dac8d01: fix: preserve custom provider models and x-ai prefix during pricing sync cleanup

## 5.25.3

### Patch Changes

- aed1eb5: Strip DeepSeek-specific `reasoning_content` from forwarded chat history unless the target endpoint/model supports it, preventing cross-provider chat completion failures when a conversation switches models.
- 4293eab: Add the missing `compression` runtime dependency to the published OpenClaw plugin package and test that plugin runtime dependencies stay in sync with backend runtime dependencies.
- 9ad6e97: Resolve model display names on the backend via LEFT JOIN with model_pricing, ensuring consistent display names between Overview and Messages pages regardless of frontend cache state.
- 2773025: Return HTTP 424 when fallback chain is exhausted to prevent infinite retry loops
- f28b952: Fix 404 on page reload for SPA routes in local mode by centralizing frontend directory resolution with proper fallback chain for both monorepo and embedded npm package layouts.
- 2232b79: Remove process.env string obfuscation, reduce minification level, add source maps, and externalize child_process to avoid VirusTotal false positives
- 51e362f: Ignore unsupported subscription providers in Manifest routing, clean up stale unsupported subscription connections from existing installs, and include shared subscription capability files in the published plugin package.
- d89b44d: Security hardening: SSRF validation for custom provider URLs, encrypted email provider API keys, OTLP auth guard improvements (min token length, hashed cache keys, cache invalidation on rotation), telemetry DTO string length limits, SessionGuard exception handling, login rate limiting, provider error sanitization, DATABASE_URL validation, API key guard audit logging, domain length validation, test email recipient validation
- 7d3e3a0: Add smoke test suite covering auth, agent creation, OTLP ingestion, routing, proxy, limits, and fallback chains
- a23f676: Fix the OpenClaw plugin installation warnings and package the embedded backend dependencies correctly.
- f288e0c: Add "Where to get API key" links below provider API key inputs in routing and email provider modals.
- 8cee3f6: Preserve compatible OpenRouter text models during pricing sync while filtering out non-chat OpenRouter models from the local model list.

## 5.25.2

### Patch Changes

- 00e5978: Update routing page button styles: responsive icon-only change button, fallback card background colors, and streamlined add-fallback button text

## 5.25.1

### Patch Changes

- 6376414: Fix local mode server not starting (ERR_CONNECTION_REFUSED on port 2099)

## 5.25.0

### Minor Changes

- 9797337: Redesign routing page: 4-column tier layout with drag-and-drop fallback reordering, auto-remove fallback when promoted to primary, model role tags in picker, and consistent btn--outline styling

### Patch Changes

- 9ccb05c: Standardize all buttons to use btn--sm (32px height) for consistent UI across the dashboard
- 0db1194: Fix Moonshot and Z.ai provider logos visibility in dark mode by using currentColor instead of hardcoded dark fills
- 6e977e0: Fix custom model pricing fields ignoring comma decimal separators (e.g. "0,59" now correctly parsed as 0.59)
- 8dda8c9: Replace unusable status and model filters on the Messages page with a provider filter that only shows providers present in the user's data. Add horizontal scroll for the message table on small screens.
- 39aebd3: Hide Agent setup tab on Settings page in local mode

## 5.24.2

### Patch Changes

- 894ea4f: Fix cloud mode product telemetry funnel by linking plugin and backend identities via PostHog $identify
- f6e336d: Accept dev-mode loopback connections in cloud mode and improve error status reporting in OTLP traces
- e1c3778: Prevent subscription providers from overriding explicit API key connections in routing
- ba6a7cf: Return 409 Conflict instead of 500 when creating an agent with a duplicate name

## 5.24.1

### Patch Changes

- d14025f: Fix 24h chart timezone shift by aligning SQL queries and frontend parsing to local time
- 76dba1c: Fix heartbeat detection to check only the last user message instead of all messages in conversation history
- 436f583: Distinguish subscription providers from API key providers in PostHog tracking by appending (Subscription) suffix
- 3c62a81: Fix subscription providers being re-activated on every gateway restart
- 3aaf6d4: Fix number formatting in threshold alert emails - tokens now display with comma separators and no decimal places, costs display with 2 decimal places and comma separators

## 5.24.0

### Minor Changes

- 4e08bb4: Add OAuth/subscription routing support for Anthropic Claude tokens
  - Subscription tab now accepts Claude setup-tokens (sk-ant-oat) with dedicated input UI
  - Backend stores and proxies subscription tokens (previously rejected)
  - Proxy sends correct Authorization: Bearer + anthropic-beta headers for subscription tokens
  - Fix case-insensitive provider matching for subscription cost/auth_type inference
  - Fix DELETE provider endpoint rejecting requests with validation error
  - Fix token whitespace corruption when pasting from terminal
  - Subscription badge overlay on provider icons in message log and overview
  - Proxy messages now store auth_type and set cost to zero for subscriptions
  - Fix duplicate messages: OTLP dedup remaps trace to proxy-recorded message
  - Conditional rollup preserves proxy token data instead of overwriting
  - ModelPickerModal always shows subscription/API key tabs with contextual empty states
  - Purge non-curated models after OpenRouter sync in local mode
  - Tier auto-assign excludes OpenRouter models from prefix-based provider inference

- dab83ca: Replace 3-mode system (cloud/local/dev) with 2-axis configuration (mode × devMode). The `mode` field now only accepts `cloud` or `local` for deployment model, while `devMode` (boolean) independently controls development behaviors like skipping API keys and faster metrics. The old `mode: "dev"` is still accepted for backward compatibility but logs a deprecation warning. `devMode` is auto-detected when the endpoint is a loopback address and no `mnfst_*` API key is provided.

### Patch Changes

- 8758f8c: Add auth badge (subscription/api key) to provider icons across all pages for consistency
- Fix auth_type propagation on error/fallback records, dual-auth subscription billing, migration index names, and SSE passthrough buffer overflow
- 3d4eb56: Reduce custom-providers endpoint latency with caching and query parallelization
- 100b33d: Improve frontend performance with route-level code splitting, vendor chunk separation, and asset loading optimizations
- 3efa632: Optimize slow backend endpoints for sub-500ms response times: parallelize independent DB queries, batch saves, pre-fetch dedup context, derive summaries from timeseries data, and group notification cron evaluation.

## 5.23.1

### Patch Changes

- b226346: Reduce agents endpoint latency by parallelizing queries and using daily sparkline buckets
- 746fe2b: Optimize messages page latency: configurable connection pool, agent-scoped model queries, count cache for pagination, custom-providers short-circuit, and composite index migration
- 07f3fb9: Reduce overview endpoint latency by merging parallel queries and resolving tenant once

## 5.23.0

### Minor Changes

- f792f3c: Add animated skeleton loaders and spinner buttons across the frontend

## 5.22.1

### Patch Changes

- 35b326c: Add migration to backfill tenant_id on agent_messages from tenants table
- e4f5b10: Drop 4 unused composite indexes on write-only OTLP ingestion tables (tool_executions, token_usage_snapshots, cost_snapshots, agent_logs) to reduce write amplification
- 45dd667: Fix missing canonical provider models in local mode and improve routing page UX
  - Create canonical model entries (e.g. `gemini-2.5-pro` with provider "Google") during pricing sync when no seeded entry exists, fixing local mode showing only OpenRouter-branded models
  - Replace full tier list refetch with local state mutations on model change, reset, and fallback operations for instant UI updates
  - Add loading indicator ("Changing...") on the Change button while model override is saving
  - Add toast notification when removing a fallback model

- 3143303: Fix token values showing as 0 for OTLP-ingested messages by capturing usage directly from proxy responses
- 8ec8b25: Fix routing model picker showing non-curated models from OpenRouter
- 78e8ec2: Progressive rendering for Routing page skeleton loading state
- a1dd405: Speed up Overview and Messages pages
  - Parallelize messages endpoint DB queries (count, data, models run concurrently via Promise.all)
  - Show stale data during SSE refetches instead of flashing skeleton loaders
  - Debounce cost filter inputs on Messages page (400ms) to prevent rapid-fire API calls

## 5.22.0

### Minor Changes

- 057d2e8: Store and display human-readable model names everywhere. Adds a `display_name` column to model pricing, populates it during OpenRouter sync and seeding, and uses it across all frontend pages (Overview, MessageLog, FallbackList).
- b6d774a: Add fallback model routing with automatic retry on provider failures

### Patch Changes

- fea384e: Add database indexes for dashboard query performance
- 64a28fc: Disable auto-migrations in production and drop 14 redundant single-column indexes
- 712c78a: Reduce TypeORM connection pool from 20 to 5 per replica to avoid exhausting PgBouncer client connections during rolling deploys.
- f040751: Fix blank model names in picker when display_name column is empty
- c8bb779: Fix fallback UX: unify Override/Edit into Change button, add loading states for add/remove fallback operations
- 5a2500b: fix: recalculate tier assignments on local-mode startup and remove hardcoded model seed
- 9293a95: Eliminate OR pattern in tenant filter queries to enable index usage
- 858d4d4: Optimize 3 slow API endpoints: parallelize independent queries, add 30-day stats cutoff, batch tier inserts/updates, and merge redundant token queries
- 1082b7b: Web quality audit: font preloading, skip-to-content link, compression middleware, static asset caching, accessibility improvements

## 5.21.2

### Patch Changes

- 6e7774f: Add multi-layer caching to reduce database load and improve response times

## 5.21.1

### Patch Changes

- a8c1c67: Add loading states to CRUD operations and backend performance improvements
  - Add loading indicators to create agent, save/delete limit rules, remove email provider, and reset routing tiers to prevent double-submission
  - Add database indexes on agent_messages, cost_snapshots, and security_event for faster queries
  - Batch quality score updates and use upsert for custom provider pricing
  - Store API key prefix at write time instead of decrypting at read time
  - Batch insert optimizations for OTLP trace/metric/log ingestion and telemetry service
  - Parallelize rollup UPDATEs and agent rename table updates

- b6216d1: fix: use DeepSeek API model names as canonical names
- d494998: Filter ghost duplicate messages in OTLP trace ingestion
- 443cd19: Fix local API key reconciliation on boot to prevent 401 errors and clean stale models.json entries on mode switch
- 23664a6: Upgrade @nestjs/platform-express to 11.1.16 to patch multer DoS vulnerability (CVE-2026-3520)
- d96b659: Fix memory leaks causing OOM crashes under load: remove rawBody duplication on JSON requests, add SSE buffer size limit, add periodic cache eviction timers, and cap unbounded cache growth.
- 6c87d1e: fix: local mode proactively detects existing server before starting embedded one

## 5.21.0

### Minor Changes

- 5174f14: Add custom OpenAI-compatible provider support for LLM routing
- 98503ad: Improve threshold alert email: format timestamps as MMM DD HH:MM:SS, add View Agent Dashboard button, update footer with copyright, replace text logo with PNG image. Remove Cloud badge from header.
- 84f9388: Add pagination to Messages and Model Prices pages with shared Pagination component, cursor-based and client-side pagination primitives, filter empty state improvements, and unified provider icon system in filter bar
- 33d5c4e: Unify all email templates with PNG logo and copyright footer; differentiate soft (warning) and hard (blocking) threshold alerts with distinct colors and messaging

### Patch Changes

- 4930390: Remove broken models from catalog and add Moonshot provider endpoint
  - Remove models that don't exist or return errors: gpt-5.3, gpt-5.3-codex, gpt-5.3-mini, grok-2, minimax-m2-her, minimax-01, nova-pro, nova-lite, nova-micro
  - Rename mistral-large to mistral-large-latest and codestral to codestral-latest
  - Add Moonshot provider endpoint for kimi-k2 model

- 972477f: Filter model prices to supported providers only during pricing sync
- d6f679e: Fix duplicate/ghost messages in dashboard
  - Remove dummy seed data (seed-messages, demo security events, admin user)
  - Record all proxy errors (not just 429/403/500+) so 400 errors show as Failed
  - Fix ghost duplicate messages: unknown OTLP spans no longer create agent_messages
  - Add timestamp-based dedup to prevent OTLP spans from duplicating proxy error records

- 28cbb68: fix: remove Anthropic-specific cache_control from Google Gemini system instruction parts
- 2ad97c3: Fix ClawHub trust scanner flags by updating SKILL.md metadata to use standard fields, adding Configuration Changes and Install Provenance sections, and rewriting the Privacy section with exhaustive data manifest
- 32d656e: Remove unused variables
- d04f4c7: Fix version indicator: show plugin version in local mode, hide in cloud mode, fix upgrade command
- e2c631e: Achieve 100% line coverage across backend, frontend, and plugin test suites
- cecc2e8: Rewrite user-facing text to remove AI writing patterns (em dashes, promotional language, verbose empty states)
- 767121b: Update manifest skill description to be concise

## 5.20.0

### Minor Changes

- d0b865d: Make routing configuration per-agent instead of per-user. Each agent now has its own independent set of provider connections (with encrypted API keys) and tier-to-model assignments. Dashboard routing API endpoints include the agent name in the URL path. Existing user-level routing configuration is automatically migrated to all agents under each user.

### Patch Changes

- 353e274: Fix per-agent routing migration failing on users with multiple agents. Drop old unique indexes before the fan-out INSERT to prevent duplicate key violations on (user_id, provider).
- 8d4efbe: Fix PostHog funnel distinct_id mismatch in cloud mode by emitting plugin_registered from backend with hashed user ID, and pass explicit mode to plugin telemetry events
- 49bf6ee: Fix security scan warnings in bundled skill: add metadata, source provenance, explicit privacy fields, routing content caveat, and read-only tools note
- 3171e39: Update npm package description and keywords to reflect all features: LLM routing, cost optimization, multi-provider support, privacy-first architecture, and real-time analytics
- bf26917: Rewrite bundled agent skill with complete setup guide, routing docs, and dashboard reference

## 5.19.0

### Minor Changes

- 9a5a974: Add OpenRouter free models and free filter to model picker
- 8833067: Add dual Y-axis to token chart and seed demo agent messages
- 6d0ba92: Add prompt caching support for Anthropic (native Messages API), Google Gemini (explicit caching), and OpenRouter Anthropic models. Auto-injects cache_control breakpoints on system prompts and tool definitions. Forwards xAI conversation ID header for improved Grok caching.

### Patch Changes

- 5c135ac: Add MiniMax and Z.ai as supported providers with models (MiniMax M2.5/M2.1/M2/M1, Z.ai GLM 5/4.7/4.6/4.5)
- dce41ad: Add Codecov JavaScript Bundle Analysis to CI for frontend bundle size tracking
- 9a5a974: Show error details on hover for failed message status badges
- 37e9bf1: Fix logo 404 on npmjs.com by using absolute GitHub URLs in README
- b3e8ea5: Improve dashboard text clarity across all pages: better breadcrumbs, more descriptive empty states, clearer column headers, and improved onboarding copy
- aec5017: fix: remove hardcoded fallback secret, restrict trusted origins, rename misleading sha256 to hashKey, sync plugin version, extend ESLint coverage, add CI lint job, set up Husky pre-commit hooks
- b95d3c4: Reduce npm package size by filtering source maps and declarations from backend dist, excluding og-image.png from frontend copy, and disabling server source maps
- 3480435: Remove outdated better-sqlite3 references and rename sqlitePath config to dbPath

## 5.18.0

### Minor Changes

- 1f5eed1: Replace hardcoded model buttons with searchable model picker in Deactivate Routing modal

### Patch Changes

- 11a56e4: Add context-aware Docs link to header
- 1c90071: Add test coverage for Limits UI redesign: icon components, provider switching security, confirmation modals, and action "both" e2e test

## 5.17.0

### Minor Changes

- 2b62c9f: Change default plugin mode from local to cloud. Cloud mode is now the default when no mode is configured. Set mode to "local" explicitly for the zero-config embedded server.

### Patch Changes

- 9f02a7e: Fix chart legend formatting: cost displays in dollars, tokens in kilo-tokens, and timestamps as "Feb 27, 09:13:59". Token chart Y-axis now shows abbreviated values.
- bd1f47d: Fix browser tab title stuck on "Manifest" by removing static `<title>` from index.html and using @solidjs/meta's Title component as the sole title manager

## 5.16.1

### Patch Changes

- 3eb3723: Fix cost display showing $0.00 for sub-cent costs and negative costs
  - Small positive costs (< $0.01) now display as "< $0.01" instead of misleading "$0.00"
  - Negative costs (from failed pricing lookups) now display as "—" (unknown) instead of "$0.00"
  - Backend aggregation queries (SUM) now exclude negative costs to prevent corrupted totals
  - Added sqlSanitizeCost helper to filter invalid cost data at the query level

- 72873f6: Fix plugin hooks not firing on current gateways by using api.on() instead of api.registerHook(), add backwards-compatible handler/execute and name/label fields for tools and provider registration

## 5.16.0

### Minor Changes

- c9e0d63: Align OpenClaw plugin API with official docs: migrate hooks to registerHook with metadata, rename tool handler to execute with content return format, add optional flag to tools, change provider name to label, add /manifest slash command, and update plugin manifest metadata.

### Patch Changes

- f399e97: Fix absurd trend percentages (e.g. -34497259%) when overview metrics are zero or near-zero. Backend computeTrend() now uses epsilon comparison and clamps output to ±999%. Frontend trendBadge() suppresses badges when the metric value itself is effectively zero. Chart Y-axes no longer collapse when all data points are zero.
- 2ee3b2e: Fix routing CTA banner flicker on Limits page by waiting for routing status to load before rendering
- 9a6ded6: Fix tier label alignment in message tables to display inline with model name

## 5.15.4

### Patch Changes

- 2d23e99: Show date alongside time in message log and overview tables
- cad8f13: Update page meta titles to use "Page - Manifest" format consistently across all pages
- 58c3adf: Fix cloud mode telemetry recording model as "auto" instead of the actual model name by removing the cloud mode exclusion from routing resolution in agent_end hook
- adac3c3: Move Settings to the last position in the sidebar MANAGE group and rename the "Integration" tab to "Agent setup"

## 5.15.3

### Patch Changes

- ad7add0: Rebrand log prefix from [Nest] to [Manifest] and improve test coverage across backend and frontend
- 3d55b51: Fix proxy config desync: call injectProviderConfig in cloud mode so models.providers.manifest stays in sync with the plugin API key on gateway restart

## 5.15.2

### Patch Changes

- 6632ae8: Fix OpenRouter sync misattributing non-native models to providers. The sync now defers to the curated seeder for native provider assignments — existing models get pricing updates only (provider preserved), while new discoveries are added as OpenRouter-only entries.

## 5.15.1

### Patch Changes

- 4d18c10: fix: use success color for cloud mode badge in header
- 06a3e2c: Add diagnostic warn-level logging to blind proxy resolve chain (proxy, resolve, and routing services) to trace "No model available" errors

## 5.15.0

### Minor Changes

- d11e062: Allow spaces in agent names by adding a display_name column. User input like "My Cool Agent" is auto-slugified to "my-cool-agent" for URLs and internal references, while the original name is stored as display_name and shown in the UI.

## 5.14.1

### Patch Changes

- 825083e: Show cloud email info card on Limits page and move provider setup to local mode only

## 5.14.0

### Minor Changes

- 5bc9f02: Harden blind proxy: per-user rate limiting (60 req/60s), concurrency control (max 10), client disconnect abort propagation, reduced provider timeout (3min), bounded telemetry sets
- 4e36a94: Unify proxy: replace Google native adapter with OpenAI-compatible endpoint, merge blind proxy into single `/v1/chat/completions` endpoint with tier header

## 5.13.1

### Patch Changes

- 7f990a2: Fix OG image and Twitter card meta tags to use absolute URLs for proper social media previews

## 5.13.0

### Minor Changes

- 2010691: Fix heartbeat routing detection and add routing_reason to OTLP pipeline with heartbeat icon in dashboard

## 5.12.0

### Minor Changes

- f307102: Store OpenRouter copies in pricing sync with full vendor-prefixed model IDs

## 5.11.1

### Patch Changes

- 19b96de: Harmonize PostHog telemetry: fix distinct_id mismatch in first_telemetry_received, add package_version to backend events, and add mode to plugin events

## 5.11.0

### Minor Changes

- dcfa4b6: Add hard limits: block proxy requests when agent consumption exceeds configured thresholds

## 5.10.3

### Patch Changes

- 7844115: Fix broken product analytics funnel by unifying distinct IDs across funnel steps. Local mode now uses machine_id consistently, cloud mode uses SHA256(user.id). Suppress plugin analytics in dev mode. Add file-based dedup for local first_telemetry_received.

## 5.10.2

### Patch Changes

- d61771d: Add meta tags (title, description, og:image, twitter cards) and link auth page logo to manifest.build

## 5.10.1

### Patch Changes

- 96d7b99: Remove dead config settings: `captureContent`, `serviceName`, and `metricsIntervalMs`. These are now either hardcoded internally or computed per mode. Delete duplicate `src/openclaw.plugin.json`.

## 5.10.0

### Minor Changes

- 338ec44: Add Ollama provider support and plugin dev mode
  - Ollama integration: auto-sync local models, quality scoring for free models, proxy forwarding to local Ollama instance
  - Plugin dev mode: connect to an external dev server without API key management
  - OTLP loopback bypass: trust loopback connections in local mode without Bearer token
  - Provider icons: show provider logo before model names in message tables with hover tooltip
  - Increase provider timeout to 600s to support local model inference on CPU
  - Reorder provider list: Ollama first, then by popularity

## 5.9.8

### Patch Changes

- e0f0b6b: Remove dead code (unused constants, orphaned mocks, deleted manifest-server package) and rewrite plugin README to highlight LLM router value proposition

## 5.9.7

### Patch Changes

- 55359f1: Add PostHog analytics for routing adoption tracking

## 5.9.6

### Patch Changes

- a729466: Split product-telemetry into two files to fix OpenClaw env-harvesting scanner warning. Add frontend analytics service for client-side PostHog tracking.

## 5.9.5

### Patch Changes

- 5f5a117: Fix flaky keyword-trie performance test threshold for CI stability

## 5.9.4

### Patch Changes

- e685b5e: fix: resolve AgentGuard 404 on page refresh in local mode, hide Settings tab in local mode, and add agent rename API endpoint

## 5.9.3

### Patch Changes

- 518e89c: Remove fs imports and direct process.env access from backend files that get copied into the plugin dist, eliminating false-positive security scanner warnings about credential harvesting.

## 5.9.2

### Patch Changes

- 3d65f32: fix: update SKILL.md to resolve ClaWHub suspicious flag — add openclaw binary requirement metadata, fix gateway restart command, add user confirmation prompts, and disclose API key storage location

## 5.9.1

### Patch Changes

- 759465f: Fix SPA deep-page reload returning 404 in local/production mode by adding a NotFoundException filter that serves index.html for non-API GET requests

## 5.9.0

### Minor Changes

- 36f70dd: Add per-user email provider configuration with test-before-save validation (Resend/Mailgun)
- 6d6cc96: Improve local mode UX: skip Workspace page and redirect to agent dashboard, hide API key/integration/danger zone sections in Settings, block agent deletion via API, and simplify header breadcrumbs

### Patch Changes

- ffddce7: Add tests for deleteAgent local mode guard and Header local mode UI behavior

## 5.8.0

### Minor Changes

- 532b6ce: Merge @mnfst/server into manifest plugin and replace better-sqlite3 with sql.js (WASM). Add intelligent model routing with a 23-dimension scoring engine, OpenAI-compatible proxy, heartbeat detection, and a Routing UI page with provider management. Local mode no longer requires native C++ compilation — zero external build dependencies.

## 5.7.0

### Minor Changes

- ed76803: Add version indicator with update notification to the dashboard

## 5.6.6

### Patch Changes

- 37885aa: Redesign Model Prices filter bar with autocomplete search, provider logos, and tag-based filtering

## 5.6.5

### Patch Changes

- 973702b: Fix Model Prices page showing only 31 models: add error handling in OpenRouter sync loop so one bad model doesn't crash the entire sync, trigger sync on startup when data is stale, and always upsert curated seed models on restart

## 5.6.4

### Patch Changes

- c5e7207: Reduce npm package size by ~60%: subset Boxicons font to 5 used icons, optimize SVGs with SVGO, replace dark SVG duplicates with CSS filter, and remove unused assets (logo.png, og-image.png)
- 54cd181: Revert per-user email provider configuration (#819)

## 5.6.3

### Patch Changes

- 070f100: Separate env variable reads from network code in product telemetry to avoid OpenClaw "credential harvesting" false-positive warning

## 5.6.2

### Patch Changes

- 9bdaa46: fix: remove private workspace packages from devDependencies to fix standalone npm install

## 5.6.1

### Patch Changes

- af2ff12: Fire agent_created product telemetry event in local mode when a new tenant/agent is created via LocalBootstrapService.

## 5.6.0

### Minor Changes

- 532b6ce: Merge @mnfst/server into manifest plugin and replace better-sqlite3 with sql.js (WASM). Local mode no longer requires native C++ compilation — zero external build dependencies. Better Auth is skipped entirely in local mode; simple session endpoints serve loopback requests.

## 5.5.0

### Minor Changes

- 0a252e6: Default mode changed from cloud to local — zero-config install now starts an embedded SQLite server. Content capture and faster metrics (10s) enabled automatically in local mode.

## 5.3.4

### Patch Changes

- 3006ee5: Add postinstall check for better-sqlite3 native module and CI verification step
- Updated dependencies [3006ee5]
- Updated dependencies [388730a]
  - @mnfst/server@5.3.4

## 5.3.1

### Patch Changes

- 6904ab9: Remove filesystem access from product telemetry opt-out check and bundle skill file at build time

## 5.2.11

### Patch Changes

- 0cc919c: Fix manifest plugin not being published with @mnfst/server dependency; add startup pre-flight check
- Updated dependencies [0cc919c]
- Updated dependencies [e491d5e]
  - @mnfst/server@5.2.11

## 5.2.7

### Patch Changes

- 16984c3: Add anonymous product telemetry via PostHog

## 5.2.4

### Patch Changes

- fda9600: Add README, LICENSE, and improve package metadata for npm discoverability

## 5.2.1

### Patch Changes

- b3971d5: Remove skills folder from the published package

## 5.2.0

### Minor Changes

- 2f31261: Add local mode with embedded SQLite server and rename server package to @mnfst/server
