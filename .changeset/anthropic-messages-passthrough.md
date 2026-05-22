---
'manifest': patch
---

refactor(proxy): forward Anthropic Messages requests to Anthropic upstreams without OpenAI translation

When a `POST /v1/messages` request resolves to an Anthropic upstream, the
proxy now forwards the original Anthropic body directly with only additive
mutations applied (cache_control on the last system block and last tool,
subscription identity injection for OAuth, default max_tokens, cached
extended-thinking replay). The OpenAI-shaped `chatBody` is retained for
the routing/scoring layer but no longer feeds the wire request.

Closes the lossy-roundtrip class of bugs that previously dropped Anthropic-
native fields (server-tool `type` discriminators, `top_k`, native
`stop_sequences` form, future Anthropic-only parameters) through the
Anthropic → OpenAI → Anthropic translation. Replaces the targeted
`_anthropicServerTools` stash workaround.
