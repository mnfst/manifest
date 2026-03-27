# manifest

## 5.33.0

### Minor Changes

- 2362dd7: Split plugin into two packages: `manifest` (full self-hosted with embedded server) and `manifest-provider` (lightweight cloud-only provider). Cloud users now install `manifest-provider` (~22KB) instead of downloading the full 50MB package. Added interactive auth onboarding via OpenClaw's Provider Plugin SDK.
- 6ce7a35: Remove standalone OTLP telemetry — all observability data now comes from the routing proxy. Users must use manifest/auto as their model. Simplified onboarding wizard to 2 steps for both cloud and local modes.

### Patch Changes

- e2363d4: Refactor routing module into focused sub-modules following SRP
- c01cf17: Update all skills for routing-only architecture. Cloud users add Manifest as a direct model provider (no plugin). Remove OTLP and telemetry references.
- 34f9a93: Improve onboarding wizard UX: lead with environment variable setup (easiest method), add openclaw onboard command, replace tabbed terminal with stacked accordion, extract shared CopyButton and ApiKeyDisplay components, add local mode ready state, improve copy and accessibility
