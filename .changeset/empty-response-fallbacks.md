# Empty response fallback fix

## What

Generalize detection of HTTP 200 responses with empty body (`content` empty/null and no `tool_calls`) as provider failures across all providers (not just Codex). When a provider returns HTTP 200 with no usable output, the response is rewritten as a synthetic HTTP 502 error so the existing fallback logic advances the chain.

## Why

Without this fix, an HTTP 200 with empty body (observed with `minimax-m3` on `ollama-cloud` during an incident with 64% empty responses) was recorded as `status=success` and never advanced `fallback_index`, causing empty generations to be served to callers as the terminal answer.

## How

This follows the same pattern as PR #2546 (commit `4e6e74a`): the `qualifyEmptyResponse()` qualifier intercepts the provider response before the fallback decision point. When no deliverable output is found, it rewrites the `Response` as a synthetic 502 with `error: { message, type: 'upstream_response_error', code: 'empty_response' }`. The existing `shouldTriggerFallback(status >= 400)` then picks it up and advances the fallback chain — no second exit-success branch is introduced.

## Which files changed

- `packages/backend/src/routing/proxy/empty-response-qualifier.ts` (new module)
- `packages/backend/src/routing/proxy/provider-client.ts` (integrated qualifier in `retryWireBody`)
- `packages/backend/.env.example` (added `EMPTY_RESPONSE_TIMEOUT_MS`)
- `docs/providers/subscription-based-providers.md` (added fallback trigger docs)
- `packages/backend/src/routing/proxy/__tests__/empty-response-qualifier.spec.ts` (new tests)
- `packages/backend/src/routing/proxy/empty-response-qualifier.spec.ts` (new tests)

## Risk

Low risk. The mechanism mirrors the existing Codex qualifier from PR #2546. Responses with actual content or tool_calls pass through unchanged. The fallback logic is unmodified — the synthetic 502 falls into the existing `shouldTriggerFallback` check.

## Verification

- All 252 `provider-client.spec.ts` tests pass
- All 49 qualifier tests pass (14 empty + 35 chatgpt-response)
- The Codex fix (4e6e74a) tests continue to pass
