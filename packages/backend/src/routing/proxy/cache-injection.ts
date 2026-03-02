/**
 * Cache control injection utilities for providers that support
 * prompt caching via the OpenAI-compatible format (e.g. OpenRouter).
 */

const CACHE_CONTROL = { type: 'ephemeral' } as const;

/**
 * Injects cache_control breakpoints into an OpenAI-format body for
 * OpenRouter requests targeting Anthropic models. OpenRouter passes
 * these through to the Anthropic backend.
 */
export function injectOpenRouterCacheControl(
  body: Record<string, unknown>,
): void {
  const messages = body.messages as Array<Record<string, unknown>> | undefined;
  if (!messages) return;

  // Find the last system/developer message and inject cache_control on its content
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== 'system' && msg.role !== 'developer') continue;

    if (typeof msg.content === 'string') {
      msg.content = [{
        type: 'text',
        text: msg.content,
        cache_control: CACHE_CONTROL,
      }];
    } else if (Array.isArray(msg.content)) {
      const blocks = msg.content as Array<Record<string, unknown>>;
      if (blocks.length > 0) {
        blocks[blocks.length - 1].cache_control = CACHE_CONTROL;
      }
    }
    break;
  }

  // Inject cache_control on the last tool definition
  const tools = body.tools as Array<Record<string, unknown>> | undefined;
  if (tools && tools.length > 0) {
    tools[tools.length - 1].cache_control = CACHE_CONTROL;
  }
}
