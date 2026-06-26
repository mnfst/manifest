# Issue 2285 Technical Spec: Direct Model Routing, Reasoning Aliases, and Client Setup

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

Transport compatibility:

- Responses-shaped upstreams used to satisfy Chat Completions requests must be safe for both client response modes.
- Endpoints that require SSE upstream while Manifest returns buffered JSON downstream declare `forceStreamForChatCompletions`.
- Non-stream Chat Completions handling must accept either upstream SSE or upstream JSON from Responses-format providers and convert both to OpenAI-compatible Chat Completions JSON.
- Normal OpenAI-compatible, Anthropic, and Google chat routes keep their provider-native response mode behavior.

Stream correctness:

- Streamed Chat Completions responses normalize terminal framing after routing has resolved, so the behavior applies equally to `auto`, `manifest/auto`, direct aliases, raw direct routes, rule aliases, and fallback-success routes.
- Raw OpenAI-compatible streams are parsed and re-emitted as `data: <valid JSON>` frames, consuming upstream `[DONE]` and emitting exactly one downstream `[DONE]`.
- Transformed streams that output OpenAI Chat Completions chunks use a terminal guard. If no chunk with `choices[0].finish_reason` is observed before upstream close, Manifest emits a synthetic `chat.completion.chunk` with `finish_reason: "stop"` before `[DONE]`.
- Native `/v1/responses` streams and Anthropic `/v1/messages` passthrough streams are not rewritten by the Chat Completions terminal guard.

## Reasoning Params

Direct aliases can store request params such as reasoning effort. The proxy applies those params before forwarding, using the existing endpoint/provider request-parameter machinery so Chat Completions and Responses requests get the correct shape.

Requests can also set `x-manifest-reasoning-effort` when the requested model resolves to a direct alias or an unambiguous raw direct route:

- The header is ignored for `auto`, `manifest/auto`, tier aliases, specificity aliases, and header-tier aliases.
- The header is consumed by Manifest and is not forwarded upstream as a provider header.
- Provider param specs choose the request-body shape, including `reasoning_effort`, `reasoning.effort`, Gemini thinking-level paths, and future provider-specific paths.
- A header that conflicts with a direct alias's stored reasoning effort returns an OpenAI-style `invalid_request_error`.
- Unsupported effort values return an OpenAI-style `invalid_request_error`.

## Frontend

Add a small API client for model aliases and integrate it into the Routing page:

- Direct alias panel for create, edit, enable/disable, and delete.
- Direct alias reasoning effort editing and variant generation.
- Rule exposure controls on tier, specificity, and header-tier cards.
- Collision-safe suggested names based on provider/auth/model.
- Existing route/auth badges should be reused.
- Setup snippets receive enabled aliases where available.
- OpenCode config generation emits every enabled alias as an available model.
- Pi setup is added as a coding-client setup surface using `models.json`.
- Warp setup is added as a coding-client setup surface. Its generated copy lists the Manifest custom endpoint fields and every enabled exposed model row; Warp generates its own internal `config_key` values.
- SDK and cURL snippets document the optional `x-manifest-reasoning-effort` header.

## Tests

Add focused coverage for:

- Alias validation and case-insensitive uniqueness.
- Disabled aliases.
- Direct alias resolution.
- Direct reasoning-header resolution and conflict/unsupported-value errors.
- Rule alias resolution.
- Ambiguous raw direct routing.
- `/v1/models` agent scoping and credential-free responses.
- Stream finalization for Responses-backed transformed streams, raw OpenAI-compatible streams that end with only `[DONE]`, and transformed Chat Completions streams that close without a terminal event.
- Streamed `/v1/chat/completions` output for `manifest/auto` and a direct alias-shaped model id has valid JSON `data:` frames, a terminal finish chunk, and `[DONE]`.
- Migration/index shape.
- Frontend creation/editing, reasoning variant generation, setup alias export, Pi setup, Warp setup, and rule exposure controls.

## Diagnostics

Use a raw-SSE probe against a local or staging Manifest instance to compare `manifest/auto`, a direct exposed alias, and a non-streaming request. The probe should send a minimal prompt, redact the bearer token from output, and validate:

- Every downstream `data:` frame parses as JSON except `data: [DONE]`.
- A final `chat.completion.chunk` with `choices[0].finish_reason` appears before `[DONE]`.
- No empty, partial, or non-JSON `data:` frames reach the client.

## Container Publishing

Fork GHCR publishing is intentionally excluded from the upstreamable implementation. The fork-only workflow lives in `.github/workflows/fork-docker.yml`, builds `docker/Dockerfile`, uses `GITHUB_TOKEN` with `packages: write`, and publishes `ghcr.io/thesammykins/manifest:latest` plus immutable `sha-<short>` tags. Keep that workflow in a separate fork patch/branch when preparing an upstream PR.
