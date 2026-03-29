# manifest

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
