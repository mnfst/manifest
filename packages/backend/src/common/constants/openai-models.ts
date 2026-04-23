/**
 * OpenAI chat-style models that only accept /v1/responses (not /v1/chat/completions).
 * The proxy swaps the endpoint at forward time; discovery keeps these so users can
 * select them. Covers: Codex (except codex-mini-latest), GPT-5+ -pro variants,
 * o1-pro, and deep-research models.
 *
 * Shared by model discovery and the routing proxy — kept in `common/constants`
 * so neither module imports from the other just for this pattern.
 */
export const OPENAI_RESPONSES_ONLY_RE =
  /(?:-codex(?!-mini-latest)|^gpt-5[^/]*-pro(?:-|$)|^o1-pro|^o4-mini-deep-research)/i;

/** Strip a single leading vendor prefix ("openai/foo" → "foo"). No-op if none. */
export function stripVendorPrefix(model: string): string {
  const slashIdx = model.indexOf('/');
  return slashIdx > 0 ? model.substring(slashIdx + 1) : model;
}
