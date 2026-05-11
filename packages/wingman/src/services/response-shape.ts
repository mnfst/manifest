/**
 * Shared extractors for the response shapes Wingman sees. The same logic was
 * inlined in three places (App.tsx, AssistantMessage.tsx, gist.ts); centralising
 * keeps Anthropic Messages support a one-shot change instead of three.
 */

export function extractAssistantText(json: unknown): string | null {
  if (!json || typeof json !== 'object') return null;
  const root = json as Record<string, unknown>;

  // OpenAI chat-completions: choices[0].message.content (string) or .text
  const choices = root.choices;
  if (Array.isArray(choices) && choices.length > 0) {
    const first = choices[0] as { message?: { content?: unknown }; text?: unknown } | undefined;
    if (first?.message && typeof first.message.content === 'string') return first.message.content;
    if (typeof first?.text === 'string') return first.text;
  }

  // Anthropic Messages: content[] with { type: 'text', text: '...' } blocks.
  // Concat all text blocks in order; ignore tool_use, thinking, etc.
  const content = root.content;
  if (Array.isArray(content)) {
    const parts: string[] = [];
    for (const block of content) {
      if (!block || typeof block !== 'object') continue;
      const b = block as Record<string, unknown>;
      if (b.type === 'text' && typeof b.text === 'string') parts.push(b.text);
    }
    if (parts.length > 0) return parts.join('');
  }

  return null;
}

export function extractUsage(json: unknown): { in?: number; out?: number; total?: number } | null {
  if (!json || typeof json !== 'object') return null;
  const usage = (json as Record<string, unknown>).usage;
  if (!usage || typeof usage !== 'object') return null;
  const u = usage as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === 'number' ? v : undefined);
  // Anthropic input_tokens is uncached only; sum cache reads + creation so the
  // displayed prompt count matches what the user actually paid for.
  const cacheRead = num(u.cache_read_input_tokens) ?? 0;
  const cacheCreation = num(u.cache_creation_input_tokens) ?? 0;
  const anthropicInput = num(u.input_tokens);
  const anthropicTotal =
    anthropicInput !== undefined ? anthropicInput + cacheRead + cacheCreation : undefined;
  const inTokens = num(u.prompt_tokens) ?? anthropicTotal;
  const outTokens = num(u.completion_tokens) ?? num(u.output_tokens);
  // The Messages API doesn't report total_tokens; derive it so the UI's token
  // chip (gated on `total`) still shows for Anthropic responses.
  const total =
    num(u.total_tokens) ??
    (inTokens !== undefined && outTokens !== undefined ? inTokens + outTokens : undefined);
  return { in: inTokens, out: outTokens, total };
}

export function extractModel(json: unknown): string | null {
  if (!json || typeof json !== 'object') return null;
  const m = (json as Record<string, unknown>).model;
  return typeof m === 'string' ? m : null;
}
