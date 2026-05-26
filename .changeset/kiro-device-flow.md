---
"manifest": minor
---

Kiro subscriptions now connect in Manifest Cloud. Kiro previously used a local-only CLI flow (reading the `kiro-cli` token cache off the backend's own disk), so it only worked when self-hosting. It now uses the AWS SSO OIDC device authorization flow server-side — register → show a user code + verification link → poll for the token — exactly like the GitHub Copilot and MiniMax subscriptions, working identically on a laptop and in the cloud.
