---
"manifest": minor
"manifest-provider": minor
---

Split plugin into two packages: `manifest` (full self-hosted with embedded server) and `manifest-provider` (lightweight cloud-only provider). Cloud users now install `manifest-provider` (~22KB) instead of downloading the full 50MB package. Added interactive auth onboarding via OpenClaw's Provider Plugin SDK.
