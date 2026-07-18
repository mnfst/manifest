type JsonRecord = Record<string, unknown>;

const ESTIMATED_CHARS_PER_TOKEN = 3.5;
const MESSAGE_OVERHEAD_TOKENS = 4;
const TOOL_OVERHEAD_TOKENS = 8;
const IMAGE_INPUT_TOKENS = 1_600;

function isRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function textWeight(value: string): number {
  return Buffer.byteLength(value, 'utf8');
}

/**
 * Estimate the input-token count expected by Anthropic's count_tokens endpoint.
 *
 * Manifest cannot use Anthropic's private tokenizer for routes that may later be
 * served by another provider. This deliberately conservative estimate prevents
 * Claude clients from issuing a second Haiku completion just to count tokens,
 * which otherwise consumes a normal inference/concurrency slot. Binary image
 * payloads are replaced with a fixed image estimate instead of counting base64
 * bytes as prompt text.
 */
export function countAnthropicInputTokens(body: unknown): number {
  if (!isRecord(body)) return 1;

  const stack: unknown[] = [body.system, body.messages, body.tools];
  const seen = new Set<object>();
  let weightedChars = 0;

  while (stack.length > 0) {
    const value = stack.pop();
    if (value === null || value === undefined) continue;

    if (typeof value === 'string') {
      weightedChars += textWeight(value);
      continue;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      weightedChars += String(value).length;
      continue;
    }
    if (Array.isArray(value)) {
      if (seen.has(value)) continue;
      seen.add(value);
      weightedChars += value.length * 2;
      for (const item of value) stack.push(item);
      continue;
    }
    if (!isRecord(value) || seen.has(value)) continue;
    seen.add(value);

    if (value.type === 'image') {
      weightedChars += IMAGE_INPUT_TOKENS * ESTIMATED_CHARS_PER_TOKEN;
      continue;
    }

    for (const [key, child] of Object.entries(value)) {
      weightedChars += textWeight(key) + 2;
      stack.push(child);
    }
  }

  const messages = Array.isArray(body.messages) ? body.messages.length : 0;
  const tools = Array.isArray(body.tools) ? body.tools.length : 0;
  const structuralOverhead = messages * MESSAGE_OVERHEAD_TOKENS + tools * TOOL_OVERHEAD_TOKENS;

  return Math.max(1, Math.ceil(weightedChars / ESTIMATED_CHARS_PER_TOKEN) + structuralOverhead);
}
