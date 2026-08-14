/**
 * xAI models that only accept /v1/responses, not /v1/chat/completions.
 *
 * xAI documents the multi-agent Grok variant as Responses API-only. Keep the
 * matcher model-family based so dated snapshots are routed with their alias.
 */
export const XAI_RESPONSES_ONLY_RE = /^grok-.*multi-agent(?:-|$)/i;
