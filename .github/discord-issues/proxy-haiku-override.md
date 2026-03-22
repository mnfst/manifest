---
title: "routing: proxy always forwards to Haiku regardless of resolved tier/model (subscription auth)"
labels: bug, severity: critical
---

## Description

Multiple users report that the routing proxy (`/v1/chat/completions`) always returns responses from `claude-3-haiku-20240307` regardless of the model resolved by the scoring engine. The `/api/v1/routing/resolve` endpoint correctly returns the expected model (e.g., `claude-opus-4-6` for complex queries), but the proxy ignores it and routes to Haiku.

All affected users are using `auth_type: subscription` (Anthropic Max).

## Symptoms

- Routing resolve correctly returns `claude-opus-4-6` for complex queries
- `/v1/chat/completions` proxy always returns `claude-3-haiku-20240307` in the response
- Haiku requests succeed, but higher-tier models (Sonnet, Opus) are never actually used
- 500 errors occur on longer prompts (likely Haiku rate limits or context overflow)

## Reports from Discord

**User: Exce55ive** ([Discord thread](https://discord.com/channels/1089907785178812499) — 2026-03-18):
> Every single request, regardless of what model you ask for, returns claude-3-haiku-20240307. Even when you explicitly pass claude-sonnet-4-6 or claude-opus-4-6, Manifest ignores it and routes to Haiku. [...] Routing resolve correctly returns claude-opus-4-6 for complex queries, but the /v1/chat/completions proxy always returns claude-3-haiku-20240307 regardless of the requested model or resolved tier. Agent: axiom, auth_type: subscription.

**User: imstevo** ([Discord thread](https://discord.com/channels/1089907785178812499) — 2026-03-21):
> I've set up Claude using the setup token it's able to route via haiku but not via opus

## Likely root cause

In `ProxyService.proxyRequest()`, when `auth_type` is `subscription`, the `ProviderClient.forward()` switches to a subscription-specific endpoint. The subscription adapter may not be passing the resolved model name correctly to the upstream provider, defaulting to the base/cheapest model.

Key code path:
1. `ResolveService.resolve()` → correctly picks tier + model
2. `ProviderClient.forward()` → switches to subscription endpoint → **model name lost here?**
3. Provider receives request with default model (Haiku)

## Related issues

- #1099 — OpenAI subscription models configured despite no connection (fixed by PR #1100, but may share root cause)
- #1193 — Sonnet 4.6 not working via Max subscription (400 error — possibly same underlying bug)

## Expected behavior

The proxy should forward the exact model returned by `ResolveService.resolve()` to the upstream provider, regardless of auth_type (api_key or subscription).
