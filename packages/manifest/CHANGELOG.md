# manifest

## 6.12.0

### Minor Changes

- 8956f43: Stop storing full message request/response bodies. The Messages page keeps the per-message metadata view (status, model, provider, tokens, cost, routing, request headers, model parameters) but the recorded-body drawer is removed. A migration drops the `message_recordings` table and the unused `llm_calls` / `tool_executions` / `agent_logs` tables, significantly reducing database storage.

### Patch Changes

- b27a16e: Stop index migrations from deadlocking deploys against live traffic. The agent_messages index migrations used blocking DDL (plain CREATE/DROP INDEX), which takes an ACCESS EXCLUSIVE lock and deadlocked against live INSERTs while the previous deployment was still serving — failing every deploy and leaving the schema (and the dashboard perf work) unshipped. Those migrations now run CONCURRENTLY (SHARE UPDATE EXCLUSIVE, which does not conflict with writes) outside a transaction, and the migration runner uses per-migration ('each') transactions. The covering index also builds without a write stall.
- 88a8590: Add a timestamp-leading partial index for cross-tenant error scans. The Cloud control plane's hourly error-insights rollup scans agent_messages by time window across all tenants, but the only error index was tenant-leading — so each run scanned every error row ever recorded (cost growing with total accumulated errors), which turned into multi-minute scans that saturated the database. A timestamp-leading partial index over error rows turns those into windowed range scans (measured 110ms/29k buffers down to 2ms/274 buffers on ~2M error rows). The index stays partial so write amplification on ingest is negligible.
- 29ee8be: Speed up the dashboard, message log, and provider/subscription lists for high-volume tenants. Distinct model/provider lookups now use an index skip-scan instead of scanning a tenant's whole history, and the Overview derives its summary cards from the timeseries it already fetches (one fewer full-range scan). A covering index lets the Overview summary, timeseries, and cost-by-model aggregations run as index-only scans on every install (previously self-hosted had none). Postgres planner defaults (JIT off, larger work_mem, SSD-tuned random_page_cost) plus tighter autovacuum on agent_messages keep those aggregations off the heap, and a redundant index is dropped to lighten ingest.
- 46c88c2: Lazy-load hidden token and cost chart series on agent overview.
- 1591e53: Name the affected agent when provider disconnect is blocked by routing.
- 8fb56c1: Speed up provider disconnect route checks and ignore disabled route rows.
- e266b8e: Support large OpenAI-compatible inline image requests on `/v1/*` with route-scoped body parsing, clear body-size errors, and redacted inline image data for routing and message recordings.
- 49ef687: Start retiring complexity and task-specific routing. Agents that never configured them now see only Default and Custom routing, so the routing page is simpler for new and unconfigured agents. Agents already using complexity tiers or task-specific categories keep everything working and see a banner explaining the change.
- 0501bb0: Improve the agent routing empty state contrast in dark mode.
- 5eec940: Stop deploys from deadlocking on database migrations. Migrations ran on every replica's boot over PgBouncer, so multi-replica deploys with pending migrations could deadlock acquiring locks on agent_messages and fail. Migrations now run once in a pre-deploy step over the direct connection (with an advisory lock so overlapping deploys serialize), before any replica starts. App-boot migration is now configurable (RUN_MIGRATIONS_ON_BOOT, default on for dev and single-instance self-hosted). The migration runner also uses the committed migration list instead of a compiled-file glob, so stale build artifacts from deleted migrations can never run.
- 100a3b4: Run database migrations under a Postgres advisory lock so concurrent runners serialize instead of deadlocking. When more than one process ran migrations at once (overlapping deployments, or replicas across regions), they could deadlock acquiring DDL locks on the high-churn agent_messages table and fail the deploy. The deploy migration step now takes a single advisory lock over the direct migration connection: the first runner applies every pending migration, the rest wait and then find nothing pending. Single-instance and self-hosted deploys are unaffected.
- ca62d7b: Clarify Xiaomi MiMo Basic API-key setup by linking directly to the API Keys console and validating the documented `sk-xxxxx` pay-as-you-go key shape separately from Token Plan `tp-` credentials.

## 6.11.0

### Minor Changes

- e30e0e9: Add global provider pages (ConnectProvider, ProviderDetail, AgentProviders tab) and lift provider connections from per-agent to user-scoped. Remove agent H1 header block from AgentDetail shell.
- 21f0981: Tenant-canonical scoping: every resource now belongs to a tenant instead of a user. The `user_providers` table is renamed to `tenant_providers` (junction column `user_provider_id` → `tenant_provider_id`), `api_keys`, `email_provider_configs`, and `custom_providers` are re-keyed by `tenant_id`, and the remaining `user_id` scope columns are dropped from routing/notification/playground tables (kept only as nullable `created_by_user_id` audit columns). Self-host operators querying the database directly should note the table/column renames; migrations run automatically on boot and abort with a clear message if orphaned rows are found (set `MANIFEST_MIGRATION_FORCE=1` to delete them instead).

### Patch Changes

- e30e0e9: "View more" on a harness's recent messages now opens the global Messages log pre-filtered to that harness.
- e30e0e9: The per-agent Overview now breaks usage down by provider (chart + provider filter), matching the global Overview.
- e30e0e9: Restructure agent detail view into a horizontal-tabbed shell (Overview / Routing / Guardrails / Settings) with back-link navigation. Unify sidebar to a single global nav (Overview / Messages / Agents) rendered identically on every authenticated route; remove the agent-scoped MONITORING/MANAGE/RESOURCES sub-nav.
- 7aa49e5: A newly added provider key no longer shows another key's usage on its connection page — per-connection analytics now attribute every message to the exact connection that served it, instead of grouping by provider, auth type, and label.
- 19b9b9e: Add AWS Bedrock as an API-key provider using Bedrock Mantle's OpenAI-compatible endpoints. Bedrock vendor-prefixed model IDs now resolve model parameters, pricing, and capabilities through the underlying provider metadata while keeping the original Bedrock ID for inference.
- 548a836: Fix Claude Code subscription routing for Anthropic Messages requests by capping Manifest-added `cache_control` markers at Anthropic's four-block limit, enabling the `context_management` beta header expected by recent Claude Code clients, and downgrading `output_config.effort: "xhigh"` when routing resolves to Sonnet.
- e30e0e9: Custom providers now display their name and models consistently across Messages, Overview, graphs and cost tables — the literal "custom:" prefix is gone and names resolve on global pages too (the backend resolves them, so deleted providers degrade gracefully).
- 550d2a4: Restore the "Add custom provider" button on the Usage-based page and use a dedicated modal for creating and editing custom providers
- 30539c2: Deleting a custom provider can no longer leave orphaned key or routing data behind: the link between custom providers and their stored keys is now enforced by the database (with automatic cleanup of any pre-existing orphans), and creating or deleting a custom provider is atomic.
- 8df85b4: Speed up global overview and Messages by collapsing overview usage timeseries queries and letting Messages load rows before exact totals/filter metadata.
- fd5bc63: Connecting a provider right after creating your first agent no longer fails with "Tenant not found" for several minutes — newly created workspaces are now visible to the dashboard immediately. When a database migration fails on startup, the logs now show the real migration error instead of a misleading "Unable to connect to the database" retry loop.
- e30e0e9: Add global dashboard with Overview, Messages, and Agents navigation for tenant-wide usage analytics.
- e30e0e9: Local providers (sidebar tab, page and overview card) are hidden on cloud — they only apply to self-hosted installs.
- 0efdb6b: Add Kiro IAM Identity Center start URL and region options to the subscription login flow.
- e30e0e9: Fix token/cost limits never blocking (or alerting) when the server's timezone isn't UTC. `computePeriodBoundaries`/`computePeriodResetDate` built their window in UTC, but `agent_messages.timestamp` rows are stored in the process's local time — so on a non-UTC host the window's upper bound sat behind the stored rows by the TZ offset and the consumption SUM read ~0, meaning hard limits silently never tripped and threshold alerts never fired. Boundaries are now computed in local time (matching `computeCutoff`), via a new `toLocalSqlTimestamp` helper.
- 2f2c8e1: Harden provider connection attribution and analytics before release. A subscription a user removed is no longer silently brought back by an agent's background re-registration. Pre-upgrade message history now attributes to the right connection for users who had the same provider on multiple agents. The dashboard overview keeps Playground traffic out of every card and chart consistently, and the provider-key cache is no longer bypassed on the proxy path.
- 28dbedb: Provider connections lifted from per-agent keys now get clearer names (e.g. "from Agent A") instead of the bare agent name.
- 3bb50ae: Provider migrations can now be rolled back without dropping connected providers.
- ed58472: Removed the leftover savings/baseline cost tracking (database columns and proxy-side computation) now that the dashboard no longer shows savings.
- e30e0e9: Removed the Subscription Savings card, chart, explainer and its API endpoints.
- 97b401a: Rename the agent_provider_access table to agent_enabled_providers so the database, API routes, and dashboard all use the same "enabled providers" naming. The migration is a pure rename — no data is modified — and rolls back cleanly.
- e30e0e9: Fix the post-create "Set up harness" modal showing the full harness picker instead of the harness you just chose. AgentGuard now refetches the agent list when the viewed agent changes, so a newly created agent's platform reaches the setup modal (previously the stale, source-less list left the platform unset whenever the agent was created from the always-present sidebar while another agent was open).
- 2492e76: Harden the tenant-scoping upgrade for large production databases. The provider-lift migration now skips rows whose agent was already deleted instead of aborting the whole upgrade with a foreign-key error, and the multi-million-row agent-message attribution backfill runs as a throttled, resumable post-deploy job (`npm run backfill:message-providers`) instead of inside the boot transaction — so upgrading no longer holds a long lock on `agent_messages`.
- d6748ad: Close a cross-tenant read path in message-detail logs (the llm_calls/agent_logs/tool_executions child queries are now tenant-scoped), and harden dashboard reliability: reject API keys past their own expiry from the auth cache, stop reporting routing-override saves that didn't persist, keep a demo-seed failure from aborting boot, and add a retryable error state to the connection page.
- 8d7f916: Add a one-time "What we just shipped" dialog for existing users that announces global providers: connect a provider once across all harnesses, scope access per harness, and track subscription vs usage-based spend per provider and harness. Dismissal is remembered locally.

## 6.10.0

### Minor Changes

- a29a705: Add a per-auth-type breakdown to the public `provider-tokens` endpoint. Each provider now carries an `auth_types` array (`{ auth_type, total_tokens, model_count }`) alongside the existing `models` list, so a provider that is used both with an API key and a subscription (e.g. OpenAI API key vs ChatGPT subscription) can be listed once per auth method. Usage with no recorded auth type is counted as `api_key`. The existing `provider`/`total_tokens`/`models` fields are unchanged, so the addition is backwards compatible.
- 43e06c6: Add Xiaomi MiMo as an API-key provider with MiMo Token Plan subscription routing.

### Patch Changes

- 17d7fd5: Fix the Anthropic subscription model catalog. Drop the `claude-*-fast` ids it pulled from the pricing cache — those 404 at `api.anthropic.com` because fast mode is an `anthropic-beta` header on the base Opus model, not a model id. Also add `claude-fable-5` (Claude Fable 5), a new subscription model that didn't match the existing `claude-*-4` prefixes.
- 6eb902d: Forward OpenAI-compatible image inputs as Anthropic image content blocks when routing Chat Completions or Responses requests to Claude.
- abbf574: Inject cache_control prompt-caching breakpoints for Anthropic subscription OAuth requests. The skip dated from a misdiagnosed 400 that was actually caused by the missing Claude Code identity block, so subscription users were re-paying their full prompt prefix in quota on every request.
- 6dc6c07: Filter ChatGPT subscription model discovery to models the Codex backend accepts with a ChatGPT account.
- 00870bf: Make Anthropic Claude Code subscription OAuth and routing match the Claude Code flow: exchange tokens through the Claude Code API host, avoid connect-time probes, and use Claude Code-compatible request headers. Also fix Anthropic OAuth pending-flow consumption so the saved provider keeps the correct agent and user IDs.
- 392efe2: Allow adaptive-only Anthropic thinking mode parameters to be reset to unset from the model parameter dialog.
- 04782c1: Restore prompt-cache hits on the ChatGPT subscription backend: send the session affinity headers the Codex CLI sends (`session-id`/`thread-id`, `x-codex-turn-state` replay, stable `prompt_cache_key`), and forward the caller's `prompt_cache_key` on OpenAI /responses conversions
- 4ea4872: Allow self-hosted installs to tune streaming warmup timeout with STREAM_WARMUP_MS.
- 3f59cc4: Route Copilot subscription models using their advertised supported endpoints so responses-only models use `/responses` directly instead of failing on `/chat/completions`.
- 96eba2d: Resolve subscription provider aliases before checking subscription support so Gemini subscriptions stored or registered as "google" remain usable for routing.
- 09a7379: Strip unsupported `exclusiveMinimum` and `exclusiveMaximum` JSON Schema fields from Google/Gemini tool declarations so function-calling requests do not fail validation.
- 8cbc0da: Forward OpenAI-compatible image inputs as Gemini inline or file data parts when routing requests to Google.
- d018cb4: Fix custom (header) routing tiers keeping stale account pins after disconnecting one of several accounts on the same provider. Provider-reference cleanup only updated complexity and specificity tiers, so disconnecting an account, renaming a key, or deactivating all providers left header-tier routes pointing at a removed account (the account chip then rendered blank). `relabelOverrides`, `cleanupProviderReferences`, and `deactivateAllProviders` now clean `header_tiers` routes the same way.
- cb48cc0: Fix OAuth subscription tokens getting permanently invalidated (#2012). Providers like OpenAI now rotate refresh tokens on every refresh, so the previous "refresh then persist" path could brick an account when parallel proxy requests refreshed the same credential at once, or when the DB write failed after the provider had already rotated. Lazy refreshes are now coordinated per credential: concurrent refreshes coalesce into a single round-trip, the freshest token is re-read from the database before refreshing, and the rotated token is persisted with retries. Applies to all subscription OAuth providers (OpenAI, Gemini, Anthropic, MiniMax, xAI, Kiro).
- 2ee31b3: Route already-resolved OpenAI `o3-deep-research` API-key requests through the Responses endpoint, matching the existing deep-research handling for `o4-mini-deep-research` without adding unavailable models to discovery. Preserve non-streaming mode when forwarding Chat Completions-shaped requests to OpenAI Responses, and surface collected Responses SSE error events as upstream failures instead of empty successful completions.
- 6677b95: Fix the Playground sending MiniMax subscription requests to the default region endpoint. The OAuth `resource_url` (which encodes the chosen region) was only applied for Gemini and dropped for MiniMax; it is now turned into a `minimax-subscription` base-URL override the same way the proxy does, so Playground requests hit the correct region. Follow-up to #2110 (cubic-flagged).
- 4a7e1fa: Normalize provider reasoning stream aliases such as Copilot's `reasoning_text` to OpenAI-compatible `reasoning_content` for chat-completions clients while preserving provider-specific replay safeguards.
- 642b162: Prevent OpenAI Responses-backed subscription streams from ending as interrupted client streams: forward terminal upstream `error` / `response.failed` events as OpenAI-compatible SSE error payloads, convert `response.incomplete` (max_output_tokens / content filter) into a proper `length` / `content_filter` finish chunk, surface upstream stream errors to `/v1/messages` clients as native Anthropic `error` events instead of a fabricated empty `end_turn` message, and stop the provider request timeout from aborting healthy streaming response bodies after headers have arrived.
- 34febf8: Fix the Playground using the wrong endpoint for region-based providers (qwen, zai) and forwarding vendor-prefixed model ids for copilot/zai. The proxy's endpoint + model resolution (region overrides for minimax/qwen/zai, prefix stripping for copilot/minimax/zai, custom-provider endpoints) is now a shared `resolveForwardEndpoint` helper used by both the proxy and the Playground, so the two paths can no longer drift.
- 6154127: Try configured tier fallback routes before the auto-assigned route when a manual override model is unavailable.

## 6.9.2

### Patch Changes

- 2d7541b: Resolve model parameter specs through the providerless modelparams.dev by-model endpoint so gateway routes such as GitHub Copilot can expose the underlying model's thinking and reasoning controls.
- 5006434: Speed up the dashboard and lower proxy overhead: unbuffered SSE streaming, smaller render-blocking CSS, lazy-loaded modals, cached per-agent model lookups, and new indexes for hot queries.
- aad3033: Fix native `/v1/responses` forwarding so typed non-message input items such as `reasoning` and `item_reference` are preserved without a `role`, preventing ChatGPT subscription Codex backend 400 errors on multi-turn Codex requests.

## 6.9.1

### Patch Changes

- e2ec0a6: Add BytePlus ModelArk Coding Plan as a subscription provider.
- 90e7af5: Add Command Code subscription routing with dynamic model discovery and OpenAI/Anthropic Provider API forwarding.
- c78f6fb: Persist refreshed OAuth subscription tokens to the same provider account label that supplied the token.
- 4884967: Add Qwen Token Plan as a subscription option for the Alibaba Cloud provider.
- 6cdd23d: Add a Z.ai GLM Coding Plan endpoint selector for outside-China and China Mainland subscription routing.

## 6.9.0

### Minor Changes

- 50e7ecd: Add OpenCode Zen as an API-key provider. OpenCode Zen exposes an OpenAI-compatible `/v1/models` catalog and `/v1/chat/completions` proxy endpoint, plus a native Anthropic `/v1/messages` endpoint for Claude models. Manifest now discovers Zen models on connect and routes Claude requests through `/v1/messages` (with `x-api-key` auth) and everything else through `/v1/chat/completions` (with Bearer auth).

### Patch Changes

- 0eff607: Keep same-name models from different providers available in the routing model picker.
- d950469: Add Fireworks AI as an official API-key routing provider.
- d439884: Add Kimi Coding Plan subscription routing for Moonshot/Kimi with the `kimi-for-coding` model.
- 31383c5: Refresh OAuth subscription credentials once when the upstream rejects a stored access token.

## 6.8.3

### Patch Changes

- 65bca08: Fix token-cost calculation for providers that report cache-read prompt tokens. Manifest now uses models.dev cache-read/cache-write prices when available, so cached DeepSeek input tokens are billed at the cache-hit rate instead of the full input-token rate.
- 08f9c6f: Fix `/v1/responses` streaming to emit the full OpenAI Responses API event lifecycle when bridging a Chat Completions upstream. The converter now opens a message item and content part (`response.output_item.added` / `response.content_part.added`) before the text deltas and closes them (`response.output_text.done` / `response.content_part.done` / `response.output_item.done`) with a populated `response.completed`, instead of emitting bare `output_text.delta` + `response.completed{output:[]}`. Strict Responses API clients (Pi, OpenClaw-style) previously dropped the deltas and rendered empty assistant messages.

## 6.8.2

### Patch Changes

- c86ab75: Record cumulative Anthropic streamed input and cache token counts when they are reported on `message_delta` events.
- 191170c: fix(charts): pad bar chart x-scale by half a bin so the last bar is fully visible (#1756)
- 3471514: Speed up the dashboard's first load. Heavy code now loads on demand instead of up front: the syntax highlighter is a slim 6-language build, charts load per tab, and the markdown renderer loads when the first message renders. Dev-only tooling no longer ships in production bundles.
- 26f3458: Limit the OAuth callback-URL tutorial video on the provider sign-in screen to OpenAI. Other OAuth providers (Gemini, etc.) no longer show the OpenAI-specific video.
- 72a398b: Separate model selector capabilities from input and output modality columns.
- d3b742f: Fix OpenCode Go reasoning-tier routing by sending qwen3.7 models through the provider's Anthropic-compatible endpoint, keeping Mimo on the OpenAI-compatible endpoint, and hardening streamed reasoning_content caching for tool-call continuations.
- 1a4063d: Replace the Routing page's empty pricing catalog panel with a concise warning toast that avoids naming implementation-specific upstream pricing sources.
- 259951e: Parse provider SSE streams with a spec-compliant parser so keepalive comments remain comments instead of being forwarded as data payloads.
- 3434f64: Close an SSRF hole where a custom provider URL written as an IPv4-mapped IPv6 literal (for example `https://[::ffff:169.254.169.254]`) slipped past the guard and could reach cloud metadata or private hosts. The carrier-grade NAT range (100.64.0.0/10, used by managed Kubernetes and Tailscale) is now blocked too. Separately, MiniMax, Kiro, and Copilot OAuth errors no longer echo refresh tokens or client secrets into logs.
- 690de8d: Request exact token usage for every supported OpenAI-compatible streamed provider by moving `stream_options.include_usage` behind endpoint capability metadata, including Kilo and NVIDIA NIM.

## 6.8.1

### Patch Changes

- ba08e72: Support adding and managing multiple GitHub Copilot subscription accounts.
- 9109d10: Keep connected subscription add-account flows visible for OAuth and device-code providers.

## 6.8.0

### Minor Changes

- 19e2d5b: Kiro subscriptions now connect in Manifest Cloud. Kiro previously used a local-only CLI flow (reading the `kiro-cli` token cache off the backend's own disk), so it only worked when self-hosting. It now uses the AWS SSO OIDC device authorization flow server-side — register → show a user code + verification link → poll for the token — exactly like the GitHub Copilot and MiniMax subscriptions, working identically on a laptop and in the cloud.

### Patch Changes

- 8061e86: Show capability badges for gateway models in the model picker. A gateway model like `opencode-go/glm-5.1` now resolves its capabilities from the underlying provider's models.dev metadata (`zai` / `glm-5.1`) instead of showing "Capabilities unknown". The resolution is gateway-generic — it keys off the shared gateway-prefix abstraction, so any gateway added later inherits it automatically.
- b13ac3d: Add Grok subscription provider support with xAI OAuth login and dynamic xAI model discovery.
- 20c7c40: Add NVIDIA NIM as an official API-key routing provider.
- f71c741: Show OpenCode Go's per-request cost in the model picker and tier cards. OpenCode Go bills a per-request slice of its dollar quota rather than a flat fee, so models with a published cost now display e.g. `$0.0136/req` instead of the generic "Included in subscription" label. The `available-models` API surfaces `cost_per_request` (from the OpenCode Go catalog) for gateway models; flat-fee subscriptions are unchanged.

## 6.7.0

### Minor Changes

- e76e89d: Add Gemini OAuth (gemini-cli / CodeAssist flow). Sign in with a personal
  Google account to route through `cloudcode-pa.googleapis.com` against
  the free-tier Gemini quota. Adds a `Sign in with Google` tile on the
  Routing page and a curated CodeAssist-supported model list, including
  Gemini 3.1 Pro Preview, Gemini 3 Flash Preview, Gemini 3.1 Flash-Lite,
  and the Gemini 2.5 models.

### Patch Changes

- 802869f: Increase the custom provider model catalog limit from 50 to 500 models.
- 9e73856: Surface Anthropic OAuth token exchange rate-limit errors instead of showing the generic expired-code message.
- a446d3e: Show model parameters for gateway models (e.g. OpenCode Go). A model like `opencode-go/deepseek-v4-pro` now resolves its parameters and capabilities from the underlying provider's catalog entry (`deepseek` / `deepseek-v4-pro`), so the params dialog, request snapshot, and outbound param defaults work the same as connecting the provider directly.
- 2509a8c: Add Kilo Gateway as an API-key provider with dynamic model discovery.
- 0e2b471: Add Kiro subscription provider support with dynamic model discovery and proxy forwarding.
- 713b070: Auto-fill custom provider model prices from exact models.dev provider/model matches, and mark exact model-only matches as estimated when no provider match is available.
- 4d1b982: Track real per-request cost for OpenCode Go subscriptions. The OpenCode Go plan is a dollar quota ($12 / 5h) consumed per request, not a flat fee, so each call now records its docs-attributed USD cost (e.g. `$12 / 880 = $0.013636` for GLM-5.1) instead of `$0.00`. Other subscription providers (Claude Max, ChatGPT Plus, GLM Coding, Copilot) continue to record `$0.00`.
- f4c3476: Add model-scoped streaming capabilities and enforce stream response mode in routing.

## 6.6.2

### Patch Changes

- b6920d3: refactor(proxy): forward Anthropic Messages requests to Anthropic upstreams without OpenAI translation

  When a `POST /v1/messages` request resolves to an Anthropic upstream, the
  proxy now forwards the original Anthropic body directly with only additive
  mutations applied (cache_control on the last system block and last tool,
  subscription identity injection for OAuth, default max_tokens, cached
  extended-thinking replay). The OpenAI-shaped `chatBody` is retained for
  the routing/scoring layer but no longer feeds the wire request.

  Closes the lossy-roundtrip class of bugs that previously dropped Anthropic-
  native fields (server-tool `type` discriminators, `top_k`, native
  `stop_sequences` form, future Anthropic-only parameters) through the
  Anthropic → OpenAI → Anthropic translation. Replaces the targeted
  `_anthropicServerTools` stash workaround.

- 07bc952: Set Claude Code setup snippets to use Manifest's `auto` model by default and expose it through `/v1/models`.
- 610c408: Show captured assistant responses as the final turn in recorded OpenAI Chat and Responses API message log conversations.
- 58dd78c: Show configured task-specific and custom tiers in the Messages tier filter and route those selections to the matching message-log filters.
- ebb1e2b: Use modelparams.dev parameter descriptions in the Model parameters dialog instead of local hardcoded hints.
- 534ff60: Refresh the Model parameters dialog with grouped cards, inline descriptions, a compact slider with min/max markers, and a synced number field. Disabled parameters now keep their description and gain a help icon explaining how to enable them, while remembering the last user value for when they become available again.
- 6cd59c7: Resolve modelparams.dev provider aliases such as Z.ai's `z-ai` catalog ID when loading configurable model parameters.
- ec47903: Keep the OpenAI OAuth callback paste field visible while an OAuth flow is active, align the OpenAI authorize request with the current Codex CLI flow, and persist pending OpenAI OAuth exchanges across backend instances.
- 261769d: fix(proxy): re-inject cached reasoning_content for OpenAI-compatible tool turns

  When reasoning providers return `reasoning_content` alongside tool calls, Manifest now caches the field and restores it on the next request if an OpenAI-compatible client dropped it from the assistant history. The replay is guarded to DeepSeek/Kimi/OpenCode Go-compatible targets and strict providers still have the field stripped.

- 130eb3c: Remove the recorded-only filter from the messages dashboard.
- 96cdd40: Persist cached `reasoning_content` for DeepSeek-compatible tool-call turns in Postgres so cloud deployments with multiple backend instances can re-inject the required field on follow-up requests.
- 2bf3734: Render recorded OpenAI Responses API request input in the message log conversation tab instead of falling back to the raw-body hint.
- d061461: fix(proxy): route xAI Responses API requests to xAI's native /v1/responses endpoint

  Adds native xAI Responses API forwarding and routes xAI multi-agent Grok models
  through /v1/responses instead of filtering them out of model discovery.

## 6.6.1

### Patch Changes

- 9d3f743: Stop recording Railway and proxy noise headers on every message. Headers injected by the hosting edge (x-railway-_, x-forwarded-_, x-real-ip, etc.) are dropped before storage, so the message Headers tab only shows headers the agent actually sent.
- 1173e30: Performance: bound the public usage-stats aggregations, add a composite `(key_prefix, is_active)` index for agent-key auth lookups, reuse uPlot chart instances in place on data refresh instead of rebuilding them, and memoize the message log's feedback overrides.

## 6.6.0

### Minor Changes

- 400c195: Add opt-in per-agent message recording. Toggle in Settings → Recording captures the full request body, response body, and response headers for subsequent proxy calls. Recorded rows show a record-dot icon in the Messages log; clicking it opens a formatted modal with Parameters, Conversation turns, Tool calls, Reply, Usage pills, and Headers. Payloads capped at 2 MB and kept out of the hot message-list query via a separate `message_recordings` table. Defaults off; never included in anonymous telemetry.

## 6.5.1

### Patch Changes

- 3b345e7: Fix provider disconnect cleanup so removing an OAuth subscription clears routes pinned to that auth type even when an API-key credential for the same provider remains connected.
- 492cf46: Preserve provider key labels and priorities when duplicating agents.
- 045907d: Preserve native Google `generationConfig` fields when routing requests to Gemini, while keeping existing OpenAI-compatible generation aliases as explicit overrides.
- 9438035: Serve model parameter specs from the MPS catalog API and support scoped per-route defaults.
- 4e780be: Make saved Manifest model parameters authoritative over overlapping client request parameters while preserving client parameters that Manifest does not configure.
- bea267e: Fetch model parameter specs per-model on demand instead of downloading the full MPS catalog on every Routing-page load, and add an ETag conditional GET to the catalog refresh. Keeps the dashboard payload flat as the catalog grows.
- 680feca: Stop slow startup model-catalog syncs from stalling boot past the deploy healthcheck. The OpenRouter, models.dev, GitHub, and modelparameters.dev fetches now run in the background instead of blocking `app.listen()`, and the two that lacked a timeout (OpenRouter, GitHub) now abort after 10s. The pricing cache still warms up with real data once those fetches land.

## 6.5.0

### Minor Changes

- c4571f7: Add Playground page: compare LLM responses from multiple models side by side for cost, output tokens, and latency. Includes request-headers popover, history drawer with replay, and markdown rendering of responses.

### Patch Changes

- f2074dd: Make Anthropic OAuth token exchange diagnostics safe when fields are missing.
- 3ff3087: Persist Anthropic OAuth pending state in Postgres so production exchanges survive reloads, restarts, and multi-instance routing.
- 7913169: Align Anthropic OAuth state handling with the Claude Code PKCE flow.
- ed05898: Add Claude Code-compatible Anthropic OAuth token headers and safe request-shape diagnostics.
- 0421e0a: Fall back to the OAuth state when Anthropic pending verifier data is missing.
- d00e52b: Fix custom providers in the Playground. Selecting a model from a custom (OpenAI/Anthropic-compatible) provider now resolves its endpoint instead of failing with "Provider request failed".
- 2b1c9b5: Hide the misleading empty "tier" label in the Playground model picker. The subtitle now only shows when a real routing tier applies.

## 6.4.0

### Minor Changes

- 24832a3: Add Nanobot to the supported personal AI agents list. The setup screen renders a paste-ready `~/.nanobot/config.json` block that points the `manifest` provider at the Manifest endpoint and selects model `auto` by default.
- d7dc183: Move request body defaults (today: DeepSeek's `thinking` toggle) from tier-scoped storage to per-route storage. Settings now travel with the model identity (`agent_id`, `provider`, `auth_type`, `model_name`) wherever the model appears — default tier primary, specificity fallback, header-tier primary, anywhere. **Behavior change:** Manifest no longer auto-disables DeepSeek's thinking mode on simple/standard/complex tiers. Users who never configured a value will see the provider's natural default (thinking enabled) instead of Manifest's previous cost-saving override. To get the old behavior back, configure thinking explicitly per-model from the Routing page once the frontend ships. Migration backfills the existing per-tier config to every compatible route in the assignment (primary + fallbacks) so no per-model setting is silently lost. Adds new endpoints `GET/PUT/DELETE /api/v1/routing/:agent/model-params` for the upcoming frontend.
- 4cba5b3: Routing UI: every model row (primary chip, fallback row, header-tier primary, header-tier fallback) now exposes the per-model Parameters affordance for any provider whose API consumes a known knob (today: DeepSeek's `thinking`). Settings travel with the model identity wherever it appears — saving DeepSeek's thinking mode on one slot updates every other slot showing the same model. Closes the long-standing gap on the "custom" (header-tier) routing surface, which previously had no params support at all. Wires the new `GET/PUT/DELETE /api/v1/routing/:agent/model-params` endpoints shipped in the backend PR.
- a8e907e: Add full OAuth flow for the Anthropic Claude Pro / Max subscription. Connecting
  your Claude subscription is now a one-click "Sign in with Claude" → paste the
  authorization code, instead of running `claude setup-token` in a separate
  terminal. Tokens auto-refresh through the same blob/refresh path used by OpenAI.

  Internally the OAuth code in `routing/oauth/` was split into shared `core/`
  primitives (PKCE, token-blob storage, pending-state TTL, callback HTML) plus
  per-provider files. The OpenAI service now delegates to the same primitives,
  and a new `oauth/anthropic/` package implements the paste-code flow.

### Patch Changes

- a254c32: Add OpenCode to the Coding Assistant setup flow. The setup screen now renders a paste-ready OpenCode config block for the global or project config, registers Manifest as an OpenAI-compatible provider, and selects `manifest/auto` by default.
- 6f52fdd: Normalize Chat Completions `image_url` parts to Responses API `input_image` parts before forwarding to `/v1/responses`.
- bbcfa50: Stop filtering the canonical `gemini-3.1-flash-lite-preview` (and similar non-dated `flash-lite-preview` aliases) from Gemini model discovery. The previous regex was meant to drop deprecated dated snapshots like `gemini-2.5-flash-lite-preview-09-2025` but over-matched and removed live preview models too. Tightened to require a `-MM-YYYY` date suffix so dated snapshots still get filtered while canonical previews surface.
- 91088e2: Fix "Add another key" button for OAuth subscription providers
- cedeba2: Extract Wingman to a standalone hosted SPA at `wingman.manifest.build`.
  The dashboard's bottom drawer stays dev-only (dead-code-eliminated from
  production / self-hosted bundles) and now embeds the hosted build by
  default. Contributors can still point it at a local Wingman with
  `VITE_WINGMAN_URL`. Dev-mode CORS allow-lists the hosted origin so
  contributors can use the hosted SPA against a local backend; production
  never enables CORS, so nothing Wingman-related ships to self-hosted
  deployments. The `packages/wingman/` workspace is removed; source moves
  to https://github.com/mnfst/wingman.
- abf3c15: Show a small "Last used" badge on the sign-in and sign-up pages so returning visitors can see at a glance which method (email or one of the social providers) they used last time. The hint is stored per-browser in `localStorage` and is best-effort: it falls back silently when storage is unavailable.
- 9b4a586: Accept MiniMax Coding Plan `sk-cp-` tokens on the MiniMax subscription tile alongside the device-code OAuth flow. The region picker now applies to both paths, so CN Coding Plan tokens route to `api.minimaxi.com` for both model discovery and proxied requests. Closes #1467.
- d9e6232: Improve the dashboard layout on phone-sized screens with a compact navigation drawer, tighter header chrome, and mobile-sized chart stats.
- 828812c: Patch five high-severity Dependabot alerts in transitive dependencies.
  - `fast-uri` 3.1.0 → 3.1.2 (path traversal + host confusion, dev-only via `@nestjs/schematics`).
  - `kysely` 0.28.14 → 0.28.17 via `better-auth` 1.4 → 1.6 (JSON-path injection in `JSONPathBuilder`, runtime).
  - `undici` 5.x → 6.25 via `@codecov/vite-plugin` 1 → 2 (HTTP smuggling + CRLF injection, dev/build only).

  No behavior change. Better Auth bump is patch-compatible (1.4 → 1.6) — login, register, OAuth round-trips verified locally.

- 7792ef8: Coerce unknown Anthropic Messages tool types to custom tools instead of forwarding unsupported server-tool tags, and normalize missing array `items` in forwarded tool schemas for OpenAI compatibility.
- 504a7af: Route Anthropic and MiniMax subscription disconnects through provider-specific OAuth cleanup endpoints
- 47d143c: Rename the personal agent category label to "AI agents".
- ee47ba7: Strip adaptive thinking when Anthropic Messages requests are routed to Claude Haiku.
- f4fb104: Preserve OpenCode Go reasoning content for known non-DeepSeek reasoning model families.

## 6.3.0

### Minor Changes

- 74f6fb3: Add `GET /api/v1/public/agent-tokens` public endpoint. Mirrors the shape of `/provider-tokens` but groups daily-token usage by `(agent_category, agent_platform)` instead of by LLM provider, so the marketing site can show per-agent (OpenClaw, Claude Code, OpenAI SDK, etc.) charts alongside the existing per-provider ones. Excludes the `other` platform bucket and `custom:*` models server-side. Gated by `MANIFEST_PUBLIC_STATS` and cached for 24h, same posture as the rest of the public-stats endpoints.

### Patch Changes

- c1fe19a: Fix GitHub Copilot routing for GPT-5 Codex models. Copilot serves Codex variants (`gpt-5-codex`, `gpt-5.2-codex`, `gpt-5.3-codex`) only via `/responses`, so chat-completions requests now swap to that endpoint instead of returning "Unsupported API for model". Also rewrites `max_tokens` to `max_completion_tokens` for the GPT-5 / o-series family on Copilot, fixing the "Unsupported parameter: 'max_tokens'" error reported alongside.
- 786dd76: Preserve Responses stream classification during stream warm-up.
- ae56a30: fix(proxy): preserve Anthropic server tools through /v1/messages double-conversion (#1886)

  Claude Code requests routed through `POST /v1/messages` to an Anthropic upstream
  failed with `tools.N.custom.input_schema: Field required` because server tools
  (web_search, bash, text_editor, computer, code_execution) lost their `type` tag
  during the Anthropic → OpenAI → Anthropic translation and were re-emitted as
  custom tools missing the required `input_schema`. Server tools are now stashed
  on the translated body and re-emitted unchanged when the upstream is Anthropic.

- d25320a: Preserve DeepSeek `reasoning_content` on every follow-up turn, regardless of which provider proxies it (OpenCode Go, custom providers, future aggregators). Fixes a hard failure on OpenCode Go's `deepseek-v4-pro` ("The reasoning_content in the thinking mode must be passed back to the API") — issue #1862.
- e7cdfa1: Strip the non-standard `ref` JSON Schema keyword (no `$` prefix) from Google Gemini tool parameters. Some tool emitters drop the `$` prefix because Protobuf and similar parsers reject dollar-prefixed field names; without this fix Manifest forwarded `ref` verbatim and Google rejected the request with `Invalid JSON payload received. Unknown name "ref"`.
- f21584a: Fix prompt-caching token counters on `/v1/messages`. `cache_control` markers always reached Anthropic (caching was working server-side), but the chat → Anthropic-Messages conversion in `toAnthropicUsage` hardcoded `cache_creation_input_tokens: 0`, and the `parseUsageObject` Anthropic branch read cache reads from the wrong key. Result: client responses lost cache creation counts, and `agent_messages` rows recorded `0` for both cache creation and cache reads even when Anthropic actually hit the cache.

  Also fixes the recorder's duplicate-write detector, which summed `input_tokens + cache_read_tokens + cache_creation_tokens` when computing a row's total prompt tokens — `input_tokens` already stored the chat-shape total, so the sum double-counted caches and caused legitimate duplicates to bypass dedup. And `toAnthropicUsage` now reads OpenAI-compat nested `prompt_tokens_details.cached_tokens` as a fallback so `/v1/messages` requests routed to OpenAI / DeepSeek / Z.AI / MiniMax / Mistral surface their cached-input counts too.

- 9f64594: Update MiniMax "Where to get an API key" link to point to the actual key page (`/user-center/basic-information/interface-key`) instead of the API docs overview.

## 6.2.2

### Patch Changes

- 562d105: Fix Groq model attribution in the routing UI so Groq-served prefixed model IDs stay selectable and show the Groq provider.

## 6.2.1

### Patch Changes

- 00784e3: Show the Model Parameters button on a routing tier when any route in the tier — primary or fallback — uses a params-compatible provider. Previously the button was gated to the primary route only, so a tier with DeepSeek configured as a fallback hid the toggle even though the proxy already applies tier-level `param_defaults` to whichever provider an attempt actually targets. The dialog's provider-default hint follows the first compatible route in the ordered (primary, …fallbacks) list.

## 6.2.0

### Minor Changes

- ef46fa0: Per-assignment request body defaults: each tier and specificity slot now carries an optional `param_defaults` JSONB column that the proxy merges into the outbound provider request before forwarding. Initial knob is DeepSeek's thinking-mode toggle (`{ thinking: { type: 'enabled' | 'disabled' } }`) — fixes empty-content responses on DeepSeek V4 Flash/Pro that consume the `max_tokens` budget on reasoning. Precedence is presence-based: client-supplied fields in the request body always win, so explicit per-call overrides keep working.

  Configure from the routing UI via a new "Parameters" button on each model chip; persisted via `PATCH /api/v1/routing/:agent/tiers/:tier/params` and `…/specificity/:category/params`.

- 085431c: Per-message model parameter telemetry. Each `agent_messages` row now carries a `request_params` JSONB snapshot of the effective request body parameters that hit the provider (today: DeepSeek's `thinking` toggle; future provider knobs and user-defined custom-provider params land here without a schema change). The dashboard's expanded message detail shows a new "Model Parameters" accordion next to Request Headers, with an info tooltip explaining the field. Existing rows stay NULL — back-compat is preserved.
- d3b551f: Per-provider model refresh: a small refresh button next to each provider in the Connect Providers detail view and next to each section header in the model picker. Toasts now report the actual count or upstream error instead of a blanket "Models refreshed" lie. Empty discovery results no longer wipe a non-empty cache, so a transient API hiccup can't silently empty the model list. The model picker subtitle now shows "Default tier" instead of just "tier".

### Patch Changes

- ec7fc12: Restore the per-tier (and per-specificity) Model Parameters dialog that was inadvertently dropped during a stacked-PR merge. The sliders icon is back on every primary model chip in Routing for providers that consume known params (today: DeepSeek's `thinking` toggle). The dialog persists per-assignment, so a single configured value applies to the primary model AND every fallback the proxy tries — without per-route schema changes. Multi-key compatible: pinning a different key on the same route does not affect the stored params, and switching keys mid-flight keeps using whatever the proxy resolved for that iteration.

  Adds back: `PATCH /api/v1/routing/:agent/tiers/:tier/params`, `…/specificity/:category/params`, `TierService.setParamDefaults`, `SpecificityService.setParamDefaults`, frontend `setTierParamDefaults` / `setSpecificityParamDefaults`, and `ModelParamsDialog`.

- c446856: fix(routing): attribute models by their connection's provider, not by model-id prefix

  The routing UI used to derive a model's logo from the prefix of its model id,
  which broke for any provider that redistributes other vendors' models. Most
  visibly, a Groq connection serving `qwen/qwen3-32b` rendered with the Qwen
  logo and Qwen-on-OpenRouter pricing (≈$0.08/$0.24 per 1M) instead of Groq's
  own pricing ($0.29/$0.59).

  Two changes:
  - **Frontend** (`RoutingTierCard.providerIdForModel`): when a model row has a
    stored `provider` that resolves to a registered first-party provider, that
    wins over prefix inference. OpenRouter remains the documented exception
    because its rows really do represent vendor-prefixed models served on behalf
    of those vendors.
  - **Backend** (`ModelDiscoveryService.enrichModel`): `known-model-prices.ts`
    is now consulted _before_ models.dev and the OpenRouter cache, so curated
    per-provider prices win over upstream catalogs that may attribute the same
    model id to a different (cheaper) inference provider. Behaviour change for
    the existing entries (moonshot-v1, gemma-3-1b-it, gemini-pro-latest): they
    become authoritative instead of last-resort, which matches their intent.

  Builds on #1772, which introduced `route.provider` as the routing identity.

## 6.1.0

### Minor Changes

- ab9f0cb: Add an Anthropic Messages-compatible endpoint at `POST /v1/messages`. Anthropic SDK clients (Claude Code, `@anthropic-ai/sdk`) can now point `ANTHROPIC_BASE_URL` at a Manifest gateway and route through Manifest's tier/specificity pipeline like any OpenAI client. The implementation translates Anthropic Messages requests into the internal chat-completions form (and back on the response side), reusing the existing routing, scoring, fallback, and recording machinery.
- 1627493: Add a "Coding Assistant" category in the agent picker and move Claude Code into it. The Connect Agent / Change Agent Type modal now shows three columns instead of two: Personal AI Agent | App AI SDK | Coding Assistant. Claude Code is no longer mis-bucketed under personal agents — it sits in the new column with the existing copper-orange Claude mark. Picker order, icons, and the existing Claude Code setup wizard are unchanged.
- fb7d921: Add support for multiple API keys per provider per agent. Users with several accounts for the same provider (a personal + work OpenAI key, two ChatGPT Plus subscriptions, two Anthropic Pro tokens) can attach all credentials and pin specific tiers or fallback rows to a specific labeled key. Multi-key applies to both `api_key` and `subscription` providers; local providers (Ollama, LM Studio) stay single-row since they don't carry credentials. Cap is 5 active keys per (agent, provider, auth_type). Single-key users see no UI change — the chip + "+ Add another key" affordance only appear once a provider has 2+ active keys.
- c6efb87: Add Wingman, an in-dashboard gateway tester for contributors. Embedded as a half-screen iframe drawer behind a floating action button in dev mode, stripped from Docker / cloud bundles. Lets contributors send one-shot requests at the gateway while impersonating OpenClaw, Hermes, OpenAI SDK, Vercel AI SDK, LangChain, cURL, or Raw — with editable code panels that actually execute via stubbed SDKs.

### Patch Changes

- 9a0e8c3: Fix silent failure when adding a fallback that shares a provider with an existing route. Adding an OpenAI API key model as a fallback to an OpenAI subscription model (or any other same-provider, different-auth combination) now persists correctly instead of showing a success toast and dropping the change. The frontend now sends the explicit `(provider, authType, model)` tuple alongside the model name so the backend can disambiguate when the same model id is offered by two connected providers. Affects both complexity tier and specificity ("custom") routing.
- 30d19ab: Stop silently wiping the saved fallback list when an unresolvable model is added (issue #1790).

  `buildFallbackRoutes()` in `tier`, `specificity`, and `header-tier` services used to return `null` whenever any single model couldn't be resolved to a unique `(provider, authType, model)` tuple. `setFallbacks` then persisted that `null`, so the user's existing `fallback_routes` row was overwritten with `null` and the controller returned `[]`. The toast still said "Fallback added" — the only visible result was the previously-saved fallbacks disappearing.

  PR #1825 already plugged the most common trigger by sending an explicit `routes` payload from the add handlers. This change removes the underlying footgun: `buildFallbackRoutes` now throws `400 Bad Request` instead of returning `null`, so the row is left untouched on resolution failure and the frontend shows the error.

  Scoped strictly to the backend wipe path. Does not change input validation, the `authType !== undefined` guard in the add handlers, or the discovery-fallback shape of `buildFallbackRoutes`.

- 022529a: Fix MiniMax Token Plan activation redirecting to the homepage. The MiniMax `/oauth/code` endpoint returns a `verification_uri` pointing at `https://www.minimax.io/oauth-authorize?...`, which 307-redirects to the homepage with no instructions. The real authorize page lives on `platform.minimax.io` (and `platform.minimaxi.com` for the CN region). The MiniMax OAuth start flow now rewrites the host before returning the URI, so users land on the actual page where their 6-digit code can be entered. Closes #1796.

## 6.0.2

### Patch Changes

- cf98f70: Fix OpenAI subscription model discovery so newer Codex CLI models (e.g. `gpt-5.5`) appear. The hardcoded `client_version=0.99.0` query param made `https://chatgpt.com/backend-api/codex/models` silently return only the older subset; bump it to `0.128.0` and lift Codex/Copilot client identifiers into a shared constants file so future bumps are a one-line change.
- a7a9c3b: Fix fallback success rows recording the primary route's `auth_type` instead of the fallback's, which caused `cost_usd` to be miscomputed on mixed-auth chains (subscription fallbacks were charged, api_key fallbacks were stored as $0).
- be679c4: Strip Codex-unsupported parameters on the OpenAI subscription proxy path. Requests forwarded to `chatgpt.com/backend-api/codex/responses` now drop `temperature`, `top_p`, `max_output_tokens`, `metadata`, `safety_identifier`, `prompt_cache_retention`, and `truncation` before the upstream call, and force `store: false`. Previously these fields propagated through and Codex returned `400 unsupported_parameter`, breaking OpenAI-SDK clients that set sampling defaults. Closes #1791.

## 6.0.1

### Patch Changes

- e8162c3: Security hardening across the build pipeline and runtime: every GitHub Action is now pinned by commit SHA, the awesome-free-llm-apis data feed is pinned to an immutable commit and validated for HTTPS shape before render, the encryption-key cache no longer keeps the raw secret as a Map key, the Google Gemini API key moves from `?key=` query param to the `x-goog-api-key` header (so it stays out of upstream proxy/LB access logs), OpenAI OAuth error logs run through `scrubSecrets`, the OAuth `backendUrl` now prefers `BETTER_AUTH_URL` over the request `Host` header, the dev-loopback agent fallback prefers the seeded tenant over picking the first active key, rejected agent keys log only the fixed `mnfst_` prefix, and migrations log via the TypeORM logger instead of `console.log`. `npm audit fix` resolved vite + postcss CVEs. A boot-time check counts active legacy static-salt API-key hashes and warns if any remain (no forced rotation). `MANIFEST_ENCRYPTION_KEY` is now documented and threaded through `docker-compose.yml`; if unset the runtime still falls back to `BETTER_AUTH_SECRET`.
- f0082d5: Fix: detect Podman and Kubernetes as self-hosted runtimes. Manifest now reads `/run/.containerenv` (Podman) and `KUBERNETES_SERVICE_HOST` in addition to `/.dockerenv`, so rootless Podman and Kubernetes installs no longer fall back to cloud-mode SSRF rules and reject `http://` URLs to local LLM servers.

  Also narrows the cloud-metadata SSRF block to the actual IMDS addresses (`169.254.169.254`, `169.254.169.253`, `100.100.100.200`, `fd00:ec2::254`) instead of the entire `169.254.0.0/16` link-local range, so self-hosted users can reach `host.containers.internal` (which Podman maps to `169.254.x.y` under pasta/slirp4netns). Cloud mode is unchanged: link-local space is still rejected via the private-IP guard.

## 6.0.0

### Major Changes

- d4675ba: Drop the legacy routing identity columns from `tier_assignments`, `specificity_assignments`, and `header_tiers`. The structured `route` shape introduced in #1772 is now the only persistence form.

  Schema: 13 columns dropped (`override_model`, `override_provider`, `override_auth_type`, `fallback_models` from all three tables; `auto_assigned_model` from tier and specificity tables). Migration `1784000000000-DropLegacyRoutingColumns` runs on boot. `down()` re-adds the columns nullable but data is one-way lost — backup before upgrading if you maintain a hot-standby.

  API breaking change: `POST /api/v1/routing/resolve` no longer returns the flat `model`, `provider`, `auth_type`, `fallback_models` fields. External callers must read `route.model`, `route.provider`, `route.authType`, and `fallback_routes` instead.

  Internals: removes the legacy inference cascade in `proxy-fallback.service.ts`, the dual-write paths in routing services, and the `?? legacy` reads throughout. Same model name on different auth types stays correctly distinct (the #1708 fix).

### Minor Changes

- 1ce8ed9: Stable error codes for the proxy. Every user-facing `[🦚 Manifest]` message now embeds an `M###` code (M001–M500) and a docs link at `manifest.build/errors/M###`. Companion encyclopedia pages live in mnfst/docs.
- 1d37134: Routing identity is now backed by a structured `ModelRoute = (provider, authType, model)` shape stored alongside the existing legacy columns on `tier_assignments`, `specificity_assignments`, and `header_tiers`. Reads prefer the new shape and fall back to legacy, so existing rows keep working without intervention. Selecting the same model name under different auth types (e.g. `gpt-4o` on subscription and on api_key) is now correctly treated as two distinct routes — fixes #1708. The `/api/v1/routing/resolve` response gains additive `route` and `fallback_routes` fields without breaking the existing flat shape. Per-fallback-attempt `auth_type` is now recorded on `agent_messages` instead of inheriting the primary's. No UI, API contract, or data is removed in this release; legacy columns and fields stay populated for one cycle before being dropped in a follow-up.

### Patch Changes

- 4e7843a: Recreating an agent with a previously used name now produces a clean slate without losing the deleted agent's history. Agent deletion is soft (the row stays with `deleted_at` set, telemetry rows are preserved) and per-agent analytics scope to the live agent's id, so the new agent starts at zero while the old data remains queryable in storage.
- 2d4a06e: Show the Manifest version in the bottom-right corner of self-hosted Docker installs. Baked into the image at build time, no API call.

## 5.58.0

### Minor Changes

- 992ae47: Add saved cost metric to the Overview dashboard showing how much money routing saves compared to using a single model

### Patch Changes

- 7394235: Mark Manifest's canned setup-prompt and limit responses as Failed in the Messages list. Requests that hit `no_provider`, `no_provider_key`, `limit_exceeded`, or `friendly_error` (the `[🦚 Manifest] …` stubs) now show a red Failed badge with a tooltip explaining why, instead of an ambiguous green Success.
- 4bd4039: Fix two routing regressions caused by agent-wrapped user messages. Strip leading metadata envelopes (e.g. `Sender (untrusted metadata):` blocks emitted by OpenClaw, NanoBot, Hermes) before scoring so simple greetings like "say hello" no longer route to standard/complex (#1766). Tighten coding specificity signals so generic agent tools (`read`, `write`, `edit`, `bash`, etc.) and tiny envelope code fences no longer hijack every prompt to the coding tier (#1767).

## 5.57.0

### Minor Changes

- eacdc3a: Revert combined cloud + self-hosted message count on `/api/v1/public/usage`. The endpoint goes back to reporting cloud-only counts. The self-hosted aggregate fetcher and its `TELEMETRY_AGGREGATE_KEY` env var are removed.

## 5.56.0

### Minor Changes

- 97bfe4e: Public usage API combines cloud and self-hosted message counts. The `/api/v1/public/usage` endpoint now adds the fleet-wide self-hosted total fetched from the peacock control plane (when `TELEMETRY_AGGREGATE_KEY` is configured) to the cloud count, falling back to cloud-only if peacock is unreachable.

### Patch Changes

- 114e684: Fix proxy recording 0 tokens and "—" cost for streaming requests against Mistral, Kimi (Moonshot), MiniMax, DeepSeek, Qwen, xAI, Z.AI, Copilot, OpenCode-Go, and custom OpenAI-compatible providers. The proxy now injects `stream_options.include_usage: true` for all OpenAI-format endpoints so usage data flows back from the upstream.

  Also fix the cache-tokens column staying empty for the same providers: usage extraction now reads `prompt_tokens_details.cached_tokens` (DeepSeek, Z.AI, Mistral, MiniMax, OpenAI shape) in addition to the top-level `cache_read_tokens` and Anthropic-native `input_tokens_details.cached_tokens` keys.

- bdb43df: Strip `reasoning_details` from message history before forwarding to non-OpenRouter providers. Mistral, Groq, and other strict OpenAI-compatible providers were rejecting requests with `extra_forbidden` (422) when conversations contained extended-thinking blocks from a prior turn.

## 5.55.5

### Patch Changes

- 40faabb: fix(dashboard): the OpenClaw setup snippet was generating a config with `api: 'openai-responses'`, but Manifest's cloud proxy speaks Chat Completions. OpenClaw rendered empty assistant bubbles even though tokens were billed correctly. Snippet now writes `api: 'openai-completions'` and the dashboard label reads "OpenAI Chat Completions-compatible". Existing OpenClaw users who pasted the broken snippet need to re-run the updated config block (or flip `models.providers.manifest.api` manually).

## 5.55.4

### Patch Changes

- b2f01c4: Drop bundled `@esbuild/linux-x64` from the Docker image so CVE scanners no longer flag the embedded Go 1.23.12 stdlib (CVE-2025-68121 plus 10 high-severity CVEs). The binary was hoisted into the production `node_modules` despite `npm ci --omit=dev`; adding `--omit=optional` removes it along with other unused platform-specific binaries.

## 5.55.3

### Patch Changes

- 77a1db3: Backend hot-path and dashboard query optimization pass: 60s LRU session cache in SessionGuard, slimmed AgentKeyAuthGuard query with 30min cache, retuned specificity miscategorization index, batched proxy fallback inserts, merged agent-list stats+sparkline into a single query, bounded distinct-models scan to 90 days, plus typed SSE events so dashboard pages only refetch on relevant changes instead of every ingest ping.
- a5f0ef9: Security audit fixes (OWASP review).
  - Auth: SessionGuard and AgentKeyAuthGuard now read `request.socket.remoteAddress` for the loopback bypass decision instead of `request.ip`, which is forgeable via `X-Forwarded-For` when `trust proxy` is enabled. The production `trust proxy` setting is narrowed to `loopback, linklocal, uniquelocal` (override with `TRUST_PROXY` env).
  - Proxy: custom-provider and subscription endpoint URLs are revalidated against the SSRF allowlist immediately before each forward (DNS-rebinding defense). All proxy `fetch()` calls now use `redirect: 'error'` to block redirect-based escalation.
  - Auth rate limiting: added per-endpoint limits for `sign-up`, `forget-password` / `forgot-password` / `reset-password`, and `verify-email` / `send-verification-email` (Better Auth runs outside NestJS so `ThrottlerGuard` doesn't apply).
  - ApiKeyGuard: DB-API-key path now populates `request.user`, so user-scoped controllers no longer crash with a 500. `@CurrentUser()` fails closed with a 401 when no user is attached.
  - Crypto: AES-GCM IV length set to the standard 12 bytes (was 16), scrypt-derived keys cached per (secret, salt) to remove the per-call ~50ms cost on the proxy hot path. Boots warns once when `MANIFEST_ENCRYPTION_KEY` falls back to `BETTER_AUTH_SECRET` in production.
  - OAuth: `backendUrl` is validated against the allowlist at storage time instead of being trusted on the way out.
  - Telemetry: `routing_tier` and `auth_type` buckets are whitelisted against the shared enums; unknown values collapse to `"other"` instead of leaking verbatim.
  - Frontend: 401 responses no longer force a redirect to `/login` for per-endpoint auth failures. Only session-shaped 401s log the user out.
  - HSTS: warns at boot when production runs without HSTS on a non-loopback bind. Silence with `MANIFEST_DISABLE_HSTS=1`.
  - Dev CORS: defaults to a single origin (`http://localhost:3000`); set `CORS_ORIGIN` for anything else.

## 5.55.2

### Patch Changes

- 3173336: Bump Docker runtime to Node 24 LTS (`gcr.io/distroless/nodejs24-debian13`). Active LTS through April 2028, replacing Node 22 (Maintenance LTS, EOL April 2027). Build and prod-deps stages move to `node:24-alpine` and `node:24-slim` to keep install and runtime majors aligned. CI and release workflows updated to Node 24. Dependabot is now pinned to ignore Node major bumps so non-LTS Current releases (Node 23, 25, 27…) won't open noisy PRs — LTS upgrades happen on a deliberate cadence.

## 5.55.1

### Patch Changes

- f5c9af8: Polish auth flow accessibility and a few content fixes from a UX audit. Login, Register, and Reset Password inputs now have proper label/`for` association, `autocomplete` attributes for password-manager autofill, and `aria-describedby` linking errors to inputs. The cooldown intervals on resend buttons clean up on unmount. The Register page now links to real Terms and Privacy URLs (was `href="#"`). Section titles on Settings and Account use `<h2>` instead of `<h3>` to fix a heading hierarchy skip. Dark-variant logos use empty alt text so screen readers don't read "Manifest" twice. The Limits "Create rule" button uses the same plus icon as Workspace's "Connect Agent" button.
- 4664b2d: Fix agent duplication not copying local/custom providers correctly
- cc09e4f: Expose the OpenAI-compatible Responses API proxy at `/v1/responses` and show Responses API setup snippets by default for OpenAI SDK users.
- 0e8035c: Fix agent duplication not copying routing mode, local provider models missing from model picker, and local provider toggle errors

## 5.55.0

### Minor Changes

- 5bafaad: feat(providers): support Anthropic-compatible custom providers

  Custom providers can now speak the Anthropic Messages API (`/v1/messages`) in addition to OpenAI's `/v1/chat/completions`. When adding a custom provider, pick the API format in the new segmented control on the form — Manifest's existing Anthropic adapter handles the translation so agents continue to call the OpenAI-compatible proxy unchanged. Useful for Azure's Anthropic endpoint and any other gateway that exposes the native Anthropic protocol.

### Patch Changes

- d6afa94: Add a llama.cpp provider tile to the API Keys tab in the self-hosted version. Clicking it probes `http://localhost:8080/v1/models` on the default llama-server port, lists every model the server exposes, and lets you connect them in one click. Pre-b3800 llama.cpp builds that don't expose `/v1/models` get a hint to upgrade or fall back to the custom-provider form. Messages and dashboard filters render llama.cpp and LM Studio as first-class providers instead of opaque `custom:<uuid>` rows.

## 5.54.0

### Minor Changes

- 466e4cf: Drop the `Enable routing` relic: remove the empty-state card on the Routing page so tabs and tier cards render by default, drop the `complexity_routing_enabled` column and its endpoints/toggle (complexity scoring is always on), delete the bulk "Disable routing" button, rename cross-page CTAs from "Enable routing" to "Connect provider", and add a Connect-providers CTA inside the model picker's empty state.
- d78828c: Surface local models (Ollama, LM Studio) as their own provider category. New `auth_type: 'local'` joins `api_key` and `subscription`; messages routed to local runners now carry a grey house badge in the message log, routing cards, and cost-by-model table. The Add Provider modal gets a third **Local** tab that appears only on self-hosted installs. Backfill migrations re-tag existing Ollama/LM Studio `user_providers` rows, and custom providers whose display name resolves to a canonical local runner are tagged `local` at insert time. Connecting/disconnecting a local provider works like the Subscription tab — click-to-disconnect flips the toggle and stops routing to it.

## 5.53.0

### Minor Changes

- 039afbe: Duplicate an agent in one click — hover any agent card on the Workspace to reveal a menu with Duplicate and Delete, or use the new "Duplicate agent" button on the Settings page. Creates a new agent with a fresh API key and carries over every provider credential, custom provider, tier override, and specificity override. Messages, logs, and notification rules stay with the original.

### Patch Changes

- 5110901: Polish routing page copy and UX: rewrite tier descriptions, standardize casing and pluralization, always show the "How routing works" help button, toggle tiers by clicking the manage-modal row, and add a pen icon on custom tier cards to open the edit modal directly.
- 91a7467: Low-risk cleanups from the 2026-04-23 OWASP audit that cause no behaviour change for operators or users:
  - Scope agent rename cascades by `tenant_id` on `agent_messages` / `notification_rules` / `notification_logs`. Forward-only fix — no backfill — so any pre-existing row that was mislabelled when slugs collided across tenants stays as-is; new renames no longer touch other tenants' data.
  - Replace `ApiKeyGuard.safeCompare` with `Buffer.from` + length-check + `timingSafeEqual`. Same observable behaviour; cleaner canonical pattern.
  - Add a snapshot test for `ThresholdAlertEmail` against hostile agent names (angle brackets, attribute-context quote payloads) — verifies React's existing escaping, no runtime change.
  - `npm audit fix` for the moderate `@nestjs/core` advisory (11.1.17 → 11.1.19).

  All other findings from the audit are deferred — they required breaking changes or operator action and live in a separate tracking issue.

## 5.52.0

### Minor Changes

- f8e00c9: Make complexity routing optional. New agents now default to a single "Default" tier that handles every request — pick one model and you're routing. Complexity routing (four tiers scored by request content) becomes an opt-in toggle on the Routing page alongside the existing task-specific routing. Existing agents keep complexity routing on with their tier picks preserved.

## 5.51.0

### Minor Changes

- 910b191: Add custom header-triggered routing tiers. Configure a tier keyed to an HTTP header key+value pair (e.g. `x-manifest-tier: premium`) and every matching request routes directly to that tier's model, overriding specificity and complexity. Each tier gets a user-picked name + color that shows as a badge on the message row. The create modal autocompletes the header key from the keys Manifest has already seen in the last 7 days, grouped by the SDK that sent them, with example values. Sensitive headers (`authorization`, `cookie`, …) are blocked from being used as match rules.

## 5.50.1

### Patch Changes

- 37308ea: Fix cost column showing "—" for self-hosted custom provider messages. Prices entered via the custom provider form are now indexed into the shared pricing cache under `custom:<uuid>/<model>` — the same key the proxy writes to `agent_messages.model` — so the cost recorder can look them up when a request is routed. The cache refreshes immediately on create, model edits, and delete, so new prices take effect without waiting for the daily 5am reload. Custom entries are scoped out of the public `/api/v1/model-prices` list so one tenant's providers can't leak into another's. Existing messages recorded with `cost_usd = null` stay null (no price snapshot is stored per message); only new messages benefit.

## 5.50.0

### Minor Changes

- abd9dea: Promote LM Studio to a first-class provider tile alongside Ollama. In the self-hosted version, clicking the LM Studio tile opens a dedicated detail view that probes `http://{localLlmHost}:1234/v1`, lists the loaded chat models, and connects them in one click — no URL typing, no manual pricing. A refresh icon re-probes after the user swaps models on the host. When the probe fails inside Docker, the detail view surfaces a two-path "Fix it" card: GUI toggle (LM Studio → Developer → "Serve on Local Network") and CLI one-liner (`lms server start --bind 0.0.0.0 --port 1234 --cors`) with a Copy button and a "one-time setup" reassurance. Embedding / reranker / moderation models are filtered out of the discovered list so they don't leak into the routing tier picker. Local-only tiles are disabled in cloud mode with an "Only available on self-hosted Manifest" hint. The `customProviderLogo` lookup now normalizes names against the shared registry, so an "LM Studio" custom provider shows the real logo everywhere (tier cards, Messages table, Model Prices, Fallback picker).

## 5.49.3

### Patch Changes

- 40e9f9f: Add `org.opencontainers.image.base.name` and `org.opencontainers.image.base.digest` OCI labels to the Docker image so Docker Scout can evaluate the "No unapproved base images" and "No outdated base images" policies.

  The published image already ships SLSA provenance and SPDX SBOM attestations (the build workflow sets `sbom: true` and `provenance: mode=max`), but Scout's base-image policies key off the OCI base-image labels on the image config and buildkit does not auto-generate them. Without the labels, Scout reports "No data" for both policies and the image is stuck at a B health score even when it has no outstanding CVEs.

  The labels sit next to the matching `FROM … AS runtime` line so a future base-image bump updates both together. No change to build output size, runtime behavior, or the attestation manifests — pure metadata addition on the image config.

## 5.49.2

### Patch Changes

- fec55cf: Bump Docker runtime to `gcr.io/distroless/nodejs22-debian13:nonroot` to clear 9 CVEs (1 CRITICAL / 8 HIGH) that the published image inherited from the older `nodejs22-debian12` base.

  Root cause: Google hasn't rebuilt any tag on `gcr.io/distroless/nodejs22-debian12` since Node 22.22.2 and Debian 12's `openssl 3.0.19-1~deb12u2` shipped. Every `debian12` variant still bakes Node 22.22.0 on top of the vulnerable `openssl 3.0.18-1~deb12u2`, so a digest refresh alone couldn't clear the scan. The `nodejs22-debian13` family already publishes Node v22.22.2 on a newer openssl, so moving the runtime stage to it fixes both CVE sources in a single base-image bump.

  The move is safe: the prod-deps stage runs `npm ci --ignore-scripts`, so no native modules are compiled and the runtime's glibc version is invisible to `node_modules`. `node:22-alpine` and `node:22-slim` digest pins were also refreshed for hygiene — those layers don't ship in the final image.

  **CVEs cleared:**
  - CVE-2025-55130 (CRITICAL, CVSS 9.1) — Node
  - CVE-2025-55131, CVE-2025-59465, CVE-2025-59466, CVE-2026-21637, CVE-2026-21710 (HIGH) — Node
  - CVE-2026-28388, CVE-2026-28389, CVE-2026-28390 (HIGH) — Debian openssl

  **Verification:** Local Trivy scan (`--severity HIGH,CRITICAL --ignore-unfixed`) reports 0 findings post-bump (was 9). `docker compose up -d` passes the healthcheck in ~14s and `/api/v1/health` returns `{"status":"healthy"}`.

## 5.49.1

### Patch Changes

- 19f6b0e: Four small Docker-compose quality-of-life fixes, all verified against an existing install without data loss:
  - **Project name pinned to `mnfst`.** Docker Compose used to infer the project name from the install directory's basename (typically `manifest`), so two unrelated projects both happening to live in a `manifest/` directory would silently share container namespace — the user who reported this saw a `Found orphan containers` warning from a completely unrelated container. Added `name: mnfst` at the top of `docker/docker-compose.yml`. Container names move from `manifest-manifest-1` / `manifest-postgres-1` to `mnfst-manifest-1` / `mnfst-postgres-1`.
  - **`pgdata` volume name pinned to `manifest_pgdata`.** With the project rename, Docker would have created a fresh empty `mnfst_pgdata` volume on next `up`, orphaning every existing self-hoster's database. Pinning `volumes.pgdata.name` to the historical `manifest_pgdata` keeps the new compose file attaching to the existing data. Verified locally: tore down an existing `manifest` stack, booted the new file from a different directory, confirmed the `mnfst-postgres-1` container mounted `manifest_pgdata` with all 51 migrations intact.
  - **Healthcheck `start_period` 45s → 90s.** On a cold first pull, Docker was flipping the container to `unhealthy` before the backend had finished pulling images + running migrations + warming the pricing cache. The 90s grace gives real installs room to boot.
  - **Log rotation.** Default Docker `json-file` logging is unbounded — a long-running install can silently fill the host disk. Both services now cap at 5 × 10 MB per container (~50 MB ceiling each).

  **CI:** added an `install-script` job in `docker-smoke.yml` that runs the actual `docker/install.sh` end-to-end against the PR-built image. Caught the `${p}` healthcheck-escape regression retroactively — and will catch the next one before it ships. The installer now reads its source from `MANIFEST_INSTALLER_SOURCE` (defaults to `main` on GitHub), so the CI job can point it at a local HTTP server serving the branch under test.

- 321a644: **Route OpenAI Codex, `-pro`, `o1-pro`, and deep-research models to `/v1/responses` for API-key users.** Closes #1660.

  OpenAI's `gpt-5.3-codex`, `gpt-5-codex`, `gpt-5.1-codex*`, `gpt-5.2-codex`, `gpt-5-pro`, `gpt-5.2-pro`, `o1-pro`, and `o4-mini-deep-research` only accept `api.openai.com/v1/responses` — they return HTTP 400 "not a chat model" on `/v1/chat/completions`. Manifest's subscription path already routed these correctly via the ChatGPT Codex backend, but API-key users always hit `/v1/chat/completions` and failed. Prod telemetry: 31 distinct users attempting Codex on API keys over the last 90 days, 36% error rate, one user stuck in a 1,400-call retry loop at 98% failure.
  - New `openai-responses` provider endpoint targeting `api.openai.com/v1/responses`, reusing the existing `chatgpt` format (same `toResponsesRequest` / `convertChatGptResponse` converters used by the subscription path — just with a plain `Authorization: Bearer` header instead of the Codex-CLI masquerade).
  - `ProviderClient.resolveEndpoint` swaps `openai` → `openai-responses` at forward time for any model matching the Responses-only regex. Subscription OAuth still routes to `openai-subscription` as before; custom endpoints are never overridden.
  - Model discovery no longer drops Codex/-pro/o1-pro/deep-research — they're kept so users can select them and the proxy routes them transparently. `gpt-image-*` is moved to the non-chat filter (it was only incidentally caught by the old Responses-only filter; it's image generation, not a chat model).
  - `OPENAI_RESPONSES_ONLY_RE` moved to `common/constants/openai-models.ts` with a shared `stripVendorPrefix` helper, so discovery and the proxy read the same source of truth without cross-module coupling.

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
