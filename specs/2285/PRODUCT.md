# Issue 2285 Product Spec: Direct Model Routing, Reasoning Aliases, and Client Setup

## Goal

Make Manifest usable as a drop-in OpenAI-compatible endpoint for clients that require a concrete model id while preserving Manifest's default dynamic routing behavior.

## User-Facing Behavior

- `/v1/models` always advertises `auto` and `manifest/auto`.
- Users can opt in additional model ids per agent by creating model aliases.
- Alias ids are agent-scoped, case-insensitively unique, and user-editable.
- Disabled aliases are hidden from `/v1/models` and rejected by proxy requests.
- Direct aliases route to a stored provider/auth/model tuple and bypass request scoring.
- Direct aliases can expose fixed reasoning variants, for example `openai-subscription/gpt-5.5-high`, by storing provider-shaped reasoning request params.
- Direct aliases can also accept a per-request `x-manifest-reasoning-effort` header. The header applies only after the requested model resolves to one concrete direct provider route.
- Rule aliases expose an existing tier, specificity, or header-tier rule as a model id and follow that rule's current route and fallback configuration.
- Raw `provider/model` direct routing is accepted only when it maps unambiguously to one enabled provider/auth route. Ambiguous matches return an OpenAI-style error asking the user to configure an alias.
- `auto` and `manifest/auto` keep the existing scoring-based route selection.
- The reasoning header never changes `auto`, tier aliases, specificity aliases, or header-tier aliases.
- Streamed Chat Completions responses always end with a valid terminal OpenAI chunk before `[DONE]`, regardless of whether the request used `manifest/auto`, a direct alias, a rule alias, a raw direct route, or a fallback route.

## Alias Types

### Direct

Direct aliases store:

- Advertised model id
- Optional display name
- Provider
- Auth type
- Model
- Optional key label
- Optional fallback routes
- Optional request params such as reasoning effort
- Response mode
- Enabled state

### Rule

Rule aliases point to one existing routing rule:

- Complexity tier
- Specificity category
- Header-tier rule

The alias resolves the rule at request time so future edits to the rule are reflected without updating the alias.

## UI Requirements

- Tier, specificity, and header-tier cards include an "Expose as model" control.
- Routing includes a compact direct alias management panel.
- Direct alias rows can edit or clear their reasoning effort.
- Direct alias controls can generate reasoning variants for the selected model.
- Alias rows show the advertised id, provider, auth badge, key label, model, reasoning effort, response mode, and enabled state.
- Suggested ids distinguish provider/auth source, for example `openai-api/...`, `openai-subscription/...`, `anthropic-api/...`, and `anthropic-subscription/...`.
- Users can edit suggested ids before saving.

## Client Setup Requirements

- OpenCode setup output includes `auto`, `manifest/auto`, and every enabled exposed alias under `provider.manifest.models`.
- Pi is a supported coding client. Its setup output uses a static `~/.pi/agent/models.json` provider configured for Manifest's OpenAI-compatible Chat Completions endpoint.
- Warp is a supported coding client. Its setup output lists the Manifest custom inference endpoint and every enabled exposed model row. Direct aliases are shown ahead of rule aliases after the `auto` rows for deterministic client testing.
- SDK and cURL setup output shows the optional `x-manifest-reasoning-effort` header for clients that prefer a base alias plus per-request reasoning control.

## Non-Goals

- Do not expose every discovered provider model by default.
- Do not leak credentials, key labels beyond configured display labels, tenant ids, or user ids through `/v1/models`.
- Do not include fork-only container publishing in the upstreamable feature patch.

## Fork Image Publishing Boundary

The fork will publish `ghcr.io/thesammykins/manifest` with `latest` and immutable `sha-*` tags from a separate patch or branch. That workflow must build the same `docker/Dockerfile`, use `GITHUB_TOKEN` with `packages: write`, and stay separate from the upstream PR.
