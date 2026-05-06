---
'manifest': minor
---

Per-assignment request body defaults: each tier and specificity slot now carries an optional `param_defaults` JSONB column that the proxy merges into the outbound provider request before forwarding. Initial knob is DeepSeek's thinking-mode toggle (`{ thinking: { type: 'enabled' | 'disabled' } }`) — fixes empty-content responses on DeepSeek V4 Flash/Pro that consume the `max_tokens` budget on reasoning. Precedence is presence-based: client-supplied fields in the request body always win, so explicit per-call overrides keep working.

Configure from the routing UI via a new "Parameters" button on each model chip; persisted via `PATCH /api/v1/routing/:agent/tiers/:tier/params` and `…/specificity/:category/params`.
