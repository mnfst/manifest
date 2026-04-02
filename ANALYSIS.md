# Bug Analysis: Anthropic Subscription Token Model Filtering

## Issue Reference
https://github.com/mnfst/manifest/issues/1448

## Summary
When a user connects with a Claude.ai subscription token (OAuth `sk-ant-oat-*`), Manifest's model discovery probes each model family at startup and treats any HTTP 400 response as "subscription tier doesn't include this family." This incorrectly filters out sonnet and opus models because the probe request itself is malformed for subscription auth, causing `invalid_request_error` responses that have nothing to do with subscription tier restrictions.

## Root Cause

### The Probe (`anthropic-subscription-probe.ts`)

The `probeModel()` function sends a minimal request to check accessibility:

```typescript
const res = await fetch(ANTHROPIC_MESSAGES_URL, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'anthropic-version': '2023-06-01',
    'anthropic-beta': 'oauth-2025-04-20',
  },
  body: JSON.stringify({
    model: modelId,
    max_tokens: 1,
    messages: [{ role: 'user', content: '.' }],
  }),
  signal: controller.signal,
});
```

Then blindly treats ALL 400 responses as subscription tier restrictions:

```typescript
if (res.status === 400) return false;  // ← THE BUG
```

### Why This Fails

1. **Overly broad 400 handling**: HTTP 400 from Anthropic can mean:
   - `invalid_request_error` — malformed request body, missing fields, wrong format
   - `authentication_error` — token doesn't cover this model tier
   - Model ID not found
   - Request schema validation failure
   
   The probe treats ALL of these as "subscription doesn't include this model family."

2. **Request format mismatch**: The probe sends a raw Anthropic Messages API request, but the actual proxy forwarding path (in `provider-client.ts`) uses `toAnthropicRequest()` with `injectCacheControl: false` for subscription auth. The probe doesn't use the same conversion pipeline, so the request format may differ from what Anthropic's subscription OAuth validation expects.

3. **No error body inspection**: The probe never reads the response body. Anthropic returns structured error responses:
   ```json
   {
     "type": "error",
     "error": {
       "type": "invalid_request_error",
       "message": "..."
     }
   }
   ```
   A proper implementation would distinguish between `invalid_request_error` (format issue) and actual subscription tier restrictions.

### The Filtering Chain

In `model-discovery.service.ts` (line ~107):
```typescript
if (lowerProvider === 'anthropic' && provider.auth_type === 'subscription' && apiKey) {
  raw = await filterBySubscriptionAccess(raw, apiKey);
}
```

This runs AFTER models are discovered, removing entire families based on the flawed probe results. So even though `supplementWithKnownModels()` correctly adds sonnet/opus to the list, the probe then removes them.

### Flow
```
1. discoverModels() discovers Anthropic models
2. supplementWithKnownModels() adds claude-opus-4, claude-sonnet-4, claude-haiku-4
3. filterBySubscriptionAccess() probes one model per family
4. Probe sends minimal request → gets 400 (format issue, NOT tier restriction)
5. Probe returns false → entire family removed
6. User sees only haiku (or nothing) in model picker
```

## Impact
- Users with Claude Max/Pro subscriptions cannot select claude-sonnet-4-6 or claude-opus models
- The subscription token IS valid for these models — they work fine when requests go through the normal proxy path
- The probe creates a false negative that silently hides accessible models

## Proposed Fix

### Approach: Remove the probe, trust the known models list

The probe was designed to handle tiered subscriptions (Pro = haiku only, Team = haiku + sonnet, Max = all). But it's unreliable because:
- It can't distinguish format errors from tier restrictions
- Anthropic's subscription error responses are opaque ("Error")
- A failing probe costs API calls and adds latency to model discovery
- The `knownModels` list in `subscription/configs.ts` already curates the correct models

**Fix**: Remove `filterBySubscriptionAccess()` from the discovery pipeline for subscription providers. Instead, rely on the curated `knownModels` list. If a user's subscription tier doesn't include a model, they'll get a clear error at request time (when they actually try to use it), which is a better UX than silently hiding models.

### Alternative: Fix the probe to inspect error types

If tiered filtering is essential, the probe should:
1. Read the error response body
2. Only treat `authentication_error` or specific tier-related error types as "not accessible"
3. Treat `invalid_request_error` as "probe failed, keep the model"
4. Use the same request pipeline (`toAnthropicRequest()`) as the proxy

## Files Involved
- `packages/backend/src/model-discovery/anthropic-subscription-probe.ts` — the buggy probe
- `packages/backend/src/model-discovery/model-discovery.service.ts` — calls the probe
- `packages/backend/src/routing/proxy/provider-endpoints.ts` — correct subscription headers
- `packages/backend/src/routing/proxy/provider-client.ts` — correct forwarding format
- `packages/shared/src/subscription/configs.ts` — knownModels list
