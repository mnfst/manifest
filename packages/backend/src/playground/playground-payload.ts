import type { PlaygroundMessageDto, RunPlaygroundDto } from './dto/run-playground.dto';

/**
 * Build the JSON body sent to the upstream provider.
 *
 * Today this is always the `{ messages: [...] }` shape. Replay (future)
 * will set `dto.rawRequestBody` instead — a verbatim recorded payload
 * that may not even be a chat-completions shape (e.g. native Anthropic
 * messages, OpenAI Responses input). Returning `unknown` here keeps the
 * seam honest: the provider client already accepts an opaque body.
 */
export function buildForwardBody(dto: RunPlaygroundDto): Record<string, unknown> {
  if (dto.rawRequestBody) return dto.rawRequestBody;
  return { messages: dto.messages ?? [] };
}

/**
 * Best-effort prompt extraction for the history row's `prompt` column.
 *
 * The `prompt` column drives the history-drawer preview ("hello, world…")
 * and the run-row index. It is not load-bearing for correctness — when
 * we can't find a user message we return an empty string. Replay (future)
 * will hand us a `rawRequestBody` whose shape we can't always interpret;
 * we walk the known shapes here so that one helper is the only place
 * that needs to grow when a new provider shape is added.
 */
export function derivePromptForHistory(dto: RunPlaygroundDto): string {
  if (dto.messages && dto.messages.length > 0) {
    const fromMessages = lastUserContent(dto.messages);
    if (fromMessages) return fromMessages;
  }
  if (dto.rawRequestBody) {
    return derivePromptFromRawBody(dto.rawRequestBody);
  }
  return '';
}

function lastUserContent(messages: PlaygroundMessageDto[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]!;
    if (m.role === 'user' && typeof m.content === 'string' && m.content.length > 0) {
      return m.content;
    }
  }
  return '';
}

function derivePromptFromRawBody(body: Record<string, unknown>): string {
  // OpenAI chat-completions / Anthropic messages: { messages: [{role, content}, ...] }
  const messages = body['messages'];
  if (Array.isArray(messages)) {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i] as { role?: unknown; content?: unknown } | null;
      if (!m || m.role !== 'user') continue;
      if (typeof m.content === 'string') {
        if (m.content.length > 0) return m.content;
        continue;
      }
      // Anthropic content can be an array of {type, text} blocks.
      if (Array.isArray(m.content)) {
        const text = m.content
          .map((p) =>
            p &&
            typeof p === 'object' &&
            'text' in p &&
            typeof (p as { text: unknown }).text === 'string'
              ? (p as { text: string }).text
              : '',
          )
          .join('');
        if (text) return text;
      }
    }
  }
  // OpenAI Responses API: { input: "..." } or { input: [{role, content}, ...] }
  const input = body['input'];
  if (typeof input === 'string') return input;
  if (Array.isArray(input)) {
    for (let i = input.length - 1; i >= 0; i--) {
      const item = input[i] as { role?: unknown; content?: unknown } | null;
      if (
        item &&
        item.role === 'user' &&
        typeof item.content === 'string' &&
        item.content.length > 0
      ) {
        return item.content;
      }
    }
  }
  return '';
}
