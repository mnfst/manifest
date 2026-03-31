# Changelog: Fix Anthropic Subscription Token Model Filtering

## Bug
Anthropic subscription tokens (OAuth `sk-ant-oat-*`) caused the model discovery probe to incorrectly filter out sonnet and opus model families. Users with valid Claude Max/Pro subscriptions could only see haiku models in the model picker.

**Root cause**: The probe treated ALL HTTP 400 responses as "subscription tier doesn't include this model." In reality, 400/`invalid_request_error` was caused by a request format mismatch in the probe itself — not a tier restriction.

**Issue**: https://github.com/mnfst/manifest/issues/1448

## Fix

### `anthropic-subscription-probe.ts`
- Parse the error response body instead of blindly treating HTTP 400 as "blocked"
- Only filter out models for genuine tier errors: `authentication_error`, `permission_error`, `not_found_error`
- Treat `invalid_request_error` as a probe format issue → keep the model
- Handle 403 responses (future-proofing for Anthropic API changes)
- Default to keeping models when error body can't be parsed

### `model-discovery.service.ts`
- Wrapped `filterBySubscriptionAccess()` in try/catch so probe failures don't remove all models

### `anthropic-subscription-probe.spec.ts`
- Updated mock to use `permission_error` (403) for genuine tier restrictions
- Added test: `invalid_request_error` keeps models (the core bug scenario)
- Added test: `permission_error` removes models (correct behavior)
- Added test: unparseable error body keeps models (graceful degradation)
