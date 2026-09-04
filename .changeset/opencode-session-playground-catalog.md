---
"manifest": patch
---

Send the `x-opencode-session` header on OpenCode Go/Zen playground forwards and model-catalog discovery (`/v1/models`), not just agent proxy traffic. OpenCode rejects requests without the header starting 09/06, so playground runs and live model discovery for `opencode-go`/`opencode-zen` now attach the same stable hashed session id used by the proxy (per-tenant Playground agent scope for the playground, per-credential scope for catalog fetches).
