---
'manifest': patch
---

Add `param_defaults` storage to header tiers (custom routing) so the same per-assignment request body defaults available on default and task-specific routing also work when a custom header tier matches. Adds the `header_tiers.param_defaults` JSONB column, the `PATCH /api/v1/routing/:agent/header-tiers/:id/params` endpoint, and threads the configured defaults through resolution into the proxy merge — applied to the primary route AND every fallback in the tier, filtered per-attempt against whichever provider the iteration is talking to. No frontend surface yet; the dialog wiring lands in a follow-up.
