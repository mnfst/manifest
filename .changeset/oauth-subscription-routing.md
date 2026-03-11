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
- Proxy messages now store auth_type and set cost to zero for subscriptions
- Fix duplicate messages: OTLP dedup remaps trace to proxy-recorded message
- Conditional rollup preserves proxy token data instead of overwriting
- ModelPickerModal always shows subscription/API key tabs with contextual empty states
- Purge non-curated models after OpenRouter sync in local mode
- Tier auto-assign excludes OpenRouter models from prefix-based provider inference
