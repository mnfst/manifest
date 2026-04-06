# manifest

## 5.41.0

### Minor Changes

- 86f4662: Add Gemini as a free provider with stable and preview models, improve custom provider logo resolution by name/URL/model, and show friendly display names for custom providers in messages and cost tables

## 5.40.0

### Minor Changes

- 416169a: Add Free Models page with Cohere provider, deep-link custom provider form via URL params, and display recognized provider logos in routing

## 5.39.1

### Patch Changes

- 8525832: Add "Claim your credits on Claude" link in Anthropic provider connect modal with info tooltip

## 5.39.0

### Minor Changes

- b70e032: Auto-show routing setup instructions modal when re-enabling routing after disable, and autofocus API key input in provider detail view

## 5.38.8

### Patch Changes

- 46e1660: Optimize frontend performance: memoize sorted rows in CostByModelTable, message chart data in Overview, and provider filter options in MessageLog with createMemo

## 5.38.7

### Patch Changes

- 10a0656: Fix Docker image vulnerabilities: override picomatch to 4.0.4, path-to-regexp to 8.4.1, brace-expansion to 5.0.5, and upgrade Alpine packages in runtime stage
- d1e603e: Improve web accessibility (WCAG AA) across the frontend
  - Add `aria-hidden="true"` to all decorative SVG icons (30+ instances)
  - Add `role="alert"` to form error messages on Login, Register, ResetPassword, EmailProviderModal, and Limits warning banner
  - Associate form labels with inputs via `for`/`id` on Workspace, LimitRuleModal, and EmailProviderModal
  - Add `aria-labelledby` to dialogs missing it (DeleteRuleModal, RemoveProviderModal, DisableRoutingModal, Settings delete modal)
  - Add `role="dialog"` and `aria-modal="true"` to Settings delete modal and DisableRoutingModal
  - Add `role="menu"` and `role="menuitem"` to kebab menu dropdown in LimitModals
  - Add `aria-label` to buttons missing accessible names (SetupWizard close, Account copy)
  - Add ESC key handling to Settings delete modal
  - Add `aria-live` region to ToastContainer for screen reader announcements
  - Add `role="status"` to standalone loading spinner in Routing page

## 5.38.6

### Patch Changes

- c0ed41f: fix: unlock sonnet/opus for Anthropic subscription tokens

  Anthropic's subscription OAuth API requires a Claude Code agent identity system prompt to access sonnet and opus model families. Without it, only haiku is accessible. This injects the required system prompt for subscription auth, matching how we already spoof Editor-Version headers for GitHub Copilot.

- 9a316c1: fix: improve provider connection UX and OAuth callback flow
- 2e0e843: Sort models alphabetically by label within each provider group and sort provider groups alphabetically by name in the model picker modal

## 5.38.5

### Patch Changes

- ae0b429: Allow configuring CSP frame-ancestors via FRAME_ANCESTORS env var

## 5.38.4

### Patch Changes

- 29e6a07: fix: OWASP security hardening - timing-safe legacy hash, email DTO validation, nonce CSP, SSRF bypass tightening, error sanitization

## 5.38.3

### Patch Changes

- a07b924: Fix missing model prices for 22 models across Mistral, Moonshot, Gemini, and OpenAI providers
  - Filter non-chat models from discovery: gemini-robotics, gpt-5-search-api, mistral-vibe-cli
  - Add -latest suffix stripping to pricing lookups in both models.dev and OpenRouter paths
  - Add legacy Mistral name aliases: open-mistral-nemo to mistral-nemo, mistral-tiny to open-mistral-7b
  - Add OpenRouter name aliases for provider API mismatches (voxtral-small to voxtral-small-24b)
  - Add hardcoded fallback prices for moonshot-v1-\* legacy models, gemma-3-1b-it, and gemini-pro-latest

- 4ce1b73: fix: null-priced models no longer treated as free in tier auto-assignment
- 6eb5976: fix: check both input and output prices before skipping enrichment, filter negative OpenRouter prices

## 5.38.2

### Patch Changes

- 3d9afa2: Fix short prompts bypassing scorer: technical prompts under 50 chars now run full keyword scoring instead of always routing to simple tier
- 3754fcb: Keep OpenRouter models in public stats endpoints, only exclude custom and unknown providers
- c1692d8: Improve public stats endpoints: better URLs, filtering, and 10-item limits

## 5.38.1

### Patch Changes

- 5b0af44: Block glm-5.1 from Z.AI model discovery (subscription-only model returns 403 on standard API)

## 5.38.0

### Minor Changes

- c32c7a1: Add public API endpoints for live usage stats and model catalog (GET /api/v1/public-stats and GET /api/v1/public-stats/models)

### Patch Changes

- fbad418: Filter non-working models from provider discovery results
  - Add Mistral-specific parser with metadata filtering (deprecation, capabilities.completion_chat)
  - Filter Mistral labs-prefixed models (require admin opt-in)
  - Filter xAI multi-agent models (not chat-compatible)
  - Filter deprecated Gemini models (gemini-2.0-flash-lite, flash-lite-preview snapshots)
  - Add per-provider exact-ID blocklist for models with no pattern (voxtral-mini-2602)

- 5102236: Fix non-streaming responses for ChatGPT subscription (Codex) models

  The Codex Responses API always returns SSE even when stream: false is requested.
  The proxy now collects the SSE events and builds a proper non-streaming OpenAI
  Chat Completion response instead of failing with a JSON parse error.

## 5.37.0

### Minor Changes

- e931715: Store agent API keys encrypted (AES-256-GCM) so users can view them anytime via a reveal/hide toggle on the Settings page, eliminating the need to rotate keys just to copy them for OpenClaw setup

### Patch Changes

- 38eebf1: Update branding prefix to include peacock emoji in plugin startup logs and proxy error messages

## 5.36.4

### Patch Changes

- 12ede3c: fix: treat upstream HTTP 424 as retriable so the fallback chain is attempted

  Previously, HTTP 424 was reused as an internal sentinel for "all fallbacks exhausted," which meant a real 424 from an upstream provider would skip the fallback chain entirely. The sentinel is now removed — the system relies on the existing `X-Manifest-Fallback-Exhausted` header and `fallback_exhausted` error type instead, and the rebuilt response preserves the primary provider's actual HTTP status.

- 8f11d57: Prefix all Manifest-originated error messages with [Manifest] to distinguish them from upstream provider errors
- ca4697e: Add HTTP-Referer and X-Title headers to OpenRouter requests for app attribution and free trial model eligibility.

## 5.36.3

### Patch Changes

- bd5134d: Filter OpenAI responses-only models (gpt-image-\*, o1-pro, o4-mini-deep-research) that fail on /v1/chat/completions.
- fae3957: Improve Settings page UX: reload page after agent rename, update API key warning text, and show API key display contextually based on key availability

## 5.36.2

### Patch Changes

- 6d635ce: Probe Anthropic subscription token access at discovery time to filter out inaccessible model families. Separate model lists by auth type so subscription and API key tabs show independent results.
- a703d0d: Expand non-chat model filter to catch additional provider-specific models that fail on chat completions: Mistral moderation/transcribe/realtime models, xAI image/video generation models, Gemini deep-research/computer-use/lyria models, and OpenAI chatgpt-image models.
- 315a08b: fix: prevent OpenRouter colon-variant models from being mis-grouped under Ollama and ensure all Ollama models appear in the routing model picker

## 5.36.1

### Patch Changes

- c36a559: Improve signup UX: show actionable error when email already exists, auto-redirect when email verification is not required, and skip email verification when no email provider is configured

## 5.36.0

### Minor Changes

- ca5fdd3: Add universal non-chat model filter, tool support filter, and thought signature cache
  - Filter non-chat models (TTS, embedding, image-gen) across all providers at discovery time
  - Filter models without tool calling support when models.dev confirms toolCall: false
  - Prefer tool-capable models in tier auto-assignment for standard/complex/reasoning tiers
  - Relax output modality check from "text-only" to "includes text" for multimodal models
  - Add ThoughtSignatureCache to re-inject thought_signature values stripped by clients during Google Gemini round-trips

### Patch Changes

- 10445f2: Return friendly chat completion messages instead of raw HTTP errors on the proxy endpoint. Invalid API keys, missing provider keys, and usage limits now appear as helpful assistant messages in the user's chat instead of cryptic "HTTP 401: Unauthorized" errors.
- 2fdc30a: Fix Agent setup tab on Settings page not rendering content when API key fetch fails
- 7d8862f: Fix Google Gemini proxy failing with "missing thought_signature" error on newer models (e.g. Gemini 3 Flash Preview) by preserving the thought_signature field through the OpenAI-compatible format conversion round-trip.
- f4a08d1: Fix onboarding dashboard URL to point to /agents/:name instead of /routing/:name

## 5.35.2

### Patch Changes

- 559107a: Prevent Chrome password save prompt on provider API key inputs by using text-security CSS masking instead of type=password.
- a5b930b: Improve alert configuration UX: replace dual-button rule type selector with a simple toggle, add notification history table, fix dark mode logo, ensure history is always logged on limit trigger, and differentiate email wording for soft alerts vs hard blocks.
- 7618fb9: Fix HTTP 400 errors from Anthropic API via routing proxy: remove redundant top-level cache_control field and filter empty text content blocks in assistant messages with tool_calls. Surface actual upstream error messages in development mode.
- bba26ee: fix: deduplicate OpenAI dated model snapshots and add dashboard URL to no-provider message
- 8b02fdc: fix: fallback chain now tries alternate auth type for same provider (#1272)

  When both subscription and API key credentials exist for the same provider, the fallback chain previously reused the same (failing) auth type instead of trying the alternate credential. This resulted in 424 errors even when a valid API key was available as fallback.

- 9e21d33: fix: resolve $0.00 cost tracking for Google Gemini models

  Fixes an issue where Gemini 2.5 Pro showed $0.00 costs despite active token usage.
  Root cause: GitHub Copilot's zero-pricing models.dev entries overwrote Google's real pricing
  in the pricing cache. Also adds daily cache reload and Google variant model name normalization.

- 9681acd: fix: validate inferred provider prefix against active providers before routing (#1383)

  Models from proxy providers (e.g. OpenRouter) carry vendor prefixes like `anthropic/claude-sonnet-4`. The router previously inferred the provider from this prefix without checking if that provider was active, causing requests to fail when the native provider was disabled.

- da231c2: Add native OpenAI subscription Responses adapter support for tool calls, including tool transcript translation, streaming function-call events, and null or multipart content normalization.

## 5.35.1

### Patch Changes

- 2929dea: Improve Model Prices page and model enrichment
  - Split Model column into separate "Model" (display name) and "Model ID" columns
  - Add green "Free" badge for free models instead of "(free)" in parentheses
  - Add models.dev as primary pricing source for Gemini models (OpenRouter as fallback)

## 5.35.0

### Minor Changes

- 8a462aa: Add models.dev as primary pricing source for model discovery
  - New ModelsDevSyncService fetches curated model data from models.dev/api.json
  - models.dev uses native provider model IDs (no normalization needed)
  - Enrichment priority: models.dev first, OpenRouter fallback
  - Smart lookupModel with 7 fallback strategies for variant model names
  - Capability flags (reasoning, toolCall) flow from models.dev to quality scoring
  - OpenAI max_tokens → max_completion_tokens conversion for GPT-5+/o-series
  - Filter non-chat models from OpenAI (embed, TTS, sora, codex) and Mistral (OCR)
  - Gemini alias/versioned model deduplication
  - Price=0 subscription models no longer overwritten by enrichment

## 5.34.0

### Minor Changes

- b65cb6f: Code quality improvements: safe JSON parsing in adapters, shared proxy types, options objects for recorder methods, notification service dedup, auth guard decomposition, TtlCache utility, frontend component decomposition, api.ts domain split

### Patch Changes

- 27e1608: Fix messages silently dropped when provider doesn't report usage data in streaming or non-streaming responses

## 5.33.20

### Patch Changes

- 2d3846b: Fix dashboard not updating in real-time after LLM calls by emitting SSE events from ProxyMessageRecorder

## 5.33.19

### Patch Changes

- b96f7ad: chore: remove obsolete OpenClaw 2026.3.22+ install workaround from READMEs

## 5.33.18

### Patch Changes

- 0d5cb03: fix: unblock plugin install on OpenClaw 2026.3.22+ by removing ClawHub skill that shadowed the npm package, add install workaround to READMEs, and improve plugin startup log formatting
- 3f01324: fix: add local-mode fallback for mnfst\_ key auth failures in AgentKeyAuthGuard

## 5.33.17

### Patch Changes

- 9ff0d35: fix: widen key_hash column to accommodate salted hash format

## 5.33.16

### Patch Changes

- f89191f: Replace process.env with ConfigService in injectable backend services to avoid OpenClaw credential-harvesting scanner warnings. Rename misleading MANIFEST_TELEMETRY_OPTOUT to MANIFEST_UPDATE_CHECK_OPTOUT.

## 5.33.15

### Patch Changes

- 41f3ce2: Unify setup wizard for local and cloud mode — remove separate local-only wizard step

## 5.33.14

### Patch Changes

- dd6bdd0: fix: remove process.env access in OpenAI OAuth service to eliminate false "credential harvesting" warning during plugin install
- 7035f6c: Rename plugin from `manifest-provider` to `manifest-model-router`. The npm package name, plugin ID, directory, and all references across CI, docs, and config have been updated.

## 5.33.13

### Patch Changes

- b3e3491: Plugin only starts embedded server — no config injection, no auto agent/tenant creation. Users create agents and connect providers through the dashboard wizard, same as cloud mode.

## 5.33.12

### Patch Changes

- cdf37f4: fix: OWASP security hardening across backend and plugins
  - Use per-key random salt for API key hashing (backward-compatible with legacy hashes)
  - Restrict local-mode auth to loopback IPs by default (opt-in LAN trust via MANIFEST_TRUST_LAN)
  - Re-enable SSRF protection in local mode for cloud metadata endpoints
  - Scope trigger-check endpoint to requesting user's notification rules
  - Fix IDOR read in deleteRule by verifying ownership before reading rule data
  - Add email validation DTO for test-saved endpoint
  - Count all proxy requests toward rate limit (not just successes)
  - Restrict dev CORS to ports 3000/3001 only
  - Return generic error messages from proxy in production mode
  - Remove devMode auto-detection in provider plugin (require explicit opt-in)
  - Strengthen URL validation with proper URL parsing
  - Add fetch timeout to provider plugin tool API calls
  - Add file locking for config file operations in manifest plugin
  - Stop forcing NODE_ENV=development in embedded plugin server
  - Restrict auto-migrations to development/test environments only

## 5.33.11

### Patch Changes

- a40111d: Set embedded server to production mode, skip seed data for plugin installs, and show dashboard URL on registration

## 5.33.10

### Patch Changes

- 8458afa: Fix local plugin startup diagnostics: validate health response is from Manifest before reusing server, move dashboard URL log to after actual startup, add post-start self-verification

## 5.33.9

### Patch Changes

- 4a3dd09: fix: guard against negative costs, return 410 for removed OTLP endpoints, skip zero-token fallback records, sanitize null content in proxy

## 5.33.8

### Patch Changes

- c43481d: Remove manifest-shared from dependencies to fix plugin install failure

## 5.33.7

### Patch Changes

- 5fee62f: Add bundleDependencies for manifest-shared to fix plugin install failure

## 5.33.6

### Patch Changes

- 5d188f7: fix: deactivate routing modal now fully removes manifest provider config from OpenClaw
- b920e9f: fix: improve routing setup instructions with full provider configuration commands

## 5.33.5

### Patch Changes

- 4e71b0d: Fix openclaw onboard verification by returning a synthetic 200 response when no providers are configured, remove non-existent copilot model, add Endpoint ID to interactive wizard instructions, and fix settings page margin.

## 5.33.4

### Patch Changes

- d4111d4: Remove environment variable setup option from agent setup UI, keeping only CLI and interactive wizard methods

## 5.33.3

### Patch Changes

- 488e511: Update logo to beta version and adjust logo sizing

## 5.33.2

### Patch Changes

- ecb76f8: Show dashboard when agent has connected providers, even before first LLM call. Add three-state empty display: "Set up agent" → "Enable routing" → dashboard. Applies to both Overview and Messages pages.

## 5.33.1

### Patch Changes

- e4e2012: fix: register AddProviderRegion migration, fix setup modal UI (tabs, copy button, borders, Done button alignment)

## 5.33.0

### Minor Changes

- 2362dd7: Split plugin into two packages: `manifest` (full self-hosted with embedded server) and `manifest-model-router` (lightweight cloud-only provider). Cloud users now install `manifest-model-router` (~22KB) instead of downloading the full 50MB package. Added interactive auth onboarding via OpenClaw's Provider Plugin SDK.
- 6ce7a35: Remove standalone OTLP telemetry — all observability data now comes from the routing proxy. Users must use manifest/auto as their model. Simplified onboarding wizard to 2 steps for both cloud and local modes.

### Patch Changes

- e2363d4: Refactor routing module into focused sub-modules following SRP
- c01cf17: Update all skills for routing-only architecture. Cloud users add Manifest as a direct model provider (no plugin). Remove OTLP and telemetry references.
- 34f9a93: Improve onboarding wizard UX: lead with environment variable setup (easiest method), add openclaw onboard command, replace tabbed terminal with stacked accordion, extract shared CopyButton and ApiKeyDisplay components, add local mode ready state, improve copy and accessibility
