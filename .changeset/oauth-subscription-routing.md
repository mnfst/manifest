---
"manifest": minor
---

Add OAuth/subscription routing support for Anthropic Claude tokens

- Subscription tab now accepts Claude setup-tokens (sk-ant-oat) with dedicated input UI
- Backend stores and proxies subscription tokens (previously rejected)
- Proxy sends correct Authorization: Bearer + anthropic-beta headers for subscription tokens
- Fix case-insensitive provider matching for subscription cost/auth_type inference
- Fix DELETE provider endpoint rejecting requests with validation error
- Fix token whitespace corruption when pasting from terminal
- Subscription badge overlay on provider icons in message log and overview
