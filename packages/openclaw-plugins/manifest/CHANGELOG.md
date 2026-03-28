# manifest

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

- 2362dd7: Split plugin into two packages: `manifest` (full self-hosted with embedded server) and `manifest-provider` (lightweight cloud-only provider). Cloud users now install `manifest-provider` (~22KB) instead of downloading the full 50MB package. Added interactive auth onboarding via OpenClaw's Provider Plugin SDK.
- 6ce7a35: Remove standalone OTLP telemetry — all observability data now comes from the routing proxy. Users must use manifest/auto as their model. Simplified onboarding wizard to 2 steps for both cloud and local modes.

### Patch Changes

- e2363d4: Refactor routing module into focused sub-modules following SRP
- c01cf17: Update all skills for routing-only architecture. Cloud users add Manifest as a direct model provider (no plugin). Remove OTLP and telemetry references.
- 34f9a93: Improve onboarding wizard UX: lead with environment variable setup (easiest method), add openclaw onboard command, replace tabbed terminal with stacked accordion, extract shared CopyButton and ApiKeyDisplay components, add local mode ready state, improve copy and accessibility
