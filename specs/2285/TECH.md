# Issue 2285 Technical Spec: Direct Model Routing and Model Aliases

## Data Model

Add `exposed_model_routes` for user-visible model ids:

- `id`
- `tenant_id`
- `agent_id`
- `model_id`
- `display_name`
- `enabled`
- `source_kind`: `direct`, `tier`, `specificity`, or `header_tier`
- `source_key`: tier slot, specificity category, or header-tier id
- `route`: stored `ModelRoute` for direct aliases
- `fallback_routes`
- `request_params`
- `response_mode`
- `created_at`
- `updated_at`

Indexes:

- Agent-scoped case-insensitive unique index on `model_id`.
- Agent/enabled index for `/v1/models`.

## API

Add authenticated routes under `/api/v1/routing/:agentName/model-aliases`:

- `GET /` list aliases for an agent.
- `POST /` create an alias.
- `PATCH /:aliasId` update editable fields.
- `PATCH /:aliasId/enabled` enable or disable an alias.
- `DELETE /:aliasId` delete an alias.

Validation:

- Reserve `auto` and `manifest/auto`.
- Trim and reject blank, whitespace-containing, or control-character model ids.
- Require `route` for `source_kind=direct`.
- Require a valid `source_key` for rule aliases.
- Validate direct routes against the agent-visible model catalog where possible.
- Validate fallback routes as `ModelRoute[]`.
- Validate response mode through the existing response-mode constants.

## `/v1/models`

Keep the endpoint behind agent API-key auth and scope results to the authenticated agent:

- Return `auto` and `manifest/auto`.
- Return enabled aliases for the agent.
- Return OpenAI-compatible model objects without credentials or internal ids.
- Do not list all discovered provider models by default.

## Proxy Resolution

Resolution order:

1. Match enabled alias by `model_id`.
2. Treat `auto` and `manifest/auto` as the existing scorer route.
3. Attempt raw direct `provider/model` only when it is unambiguous.
4. Return an OpenAI-style invalid request error for disabled, unknown, or ambiguous direct model ids.

Alias routing:

- Direct aliases build a resolved route from stored `route`, `fallback_routes`, `request_params`, and `response_mode`.
- Tier aliases call the existing tier resolver.
- Specificity aliases resolve the current specificity assignment route and fallback configuration.
- Header-tier aliases resolve the current header-tier route and fallback configuration.
- Alias routing bypasses scoring but continues to use provider credentials, fallbacks, response conversion, rate limits, and message recording.

## Reasoning Params

Direct aliases can store request params such as reasoning effort. The proxy applies those params before forwarding, using the existing endpoint/provider request-parameter machinery so Chat Completions and Responses requests get the correct shape.

## Frontend

Add a small API client for model aliases and integrate it into the Routing page:

- Direct alias panel for create, edit, enable/disable, and delete.
- Rule exposure controls on tier, specificity, and header-tier cards.
- Collision-safe suggested names based on provider/auth/model.
- Existing route/auth badges should be reused.

## Tests

Add focused coverage for:

- Alias validation and case-insensitive uniqueness.
- Disabled aliases.
- Direct alias resolution.
- Rule alias resolution.
- Ambiguous raw direct routing.
- `/v1/models` agent scoping and credential-free responses.
- Migration/index shape.
- Frontend creation/editing and rule exposure controls.

## Container Publishing

Fork GHCR publishing is intentionally excluded from the upstreamable implementation. The fork-only workflow lives in `.github/workflows/fork-docker.yml`, builds `docker/Dockerfile`, uses `GITHUB_TOKEN` with `packages: write`, and publishes `ghcr.io/thesammykins/manifest:latest` plus immutable `sha-<short>` tags. Keep that workflow in a separate fork patch/branch when preparing an upstream PR.
