import { formatSSE, isObjectRecord } from './chatgpt-helpers';

export interface OpenAiChatCompletionStreamNormalizer {
  transform: (chunk: string) => string | null;
  finalize: () => string | null;
}

export interface OpenAiChatCompletionTerminalGuard {
  transform: (sseText: string | null) => string | null;
  finalize: () => string | null;
}

function extractJsonPayload(eventText: string): string {
  return eventText
    .split('\n')
    .map((line) => line.trim())
    .filter(
      (line) =>
        line &&
        !line.startsWith('event:') &&
        !line.startsWith('id:') &&
        !line.startsWith('retry:') &&
        !line.startsWith(':'),
    )
    .map((line) => (line.startsWith('data:') ? line.slice(5).trim() : line))
    .join('\n')
    .trim();
}

function parseJsonPayload(payload: string): unknown {
  try {
    return JSON.parse(payload) as unknown;
  } catch {
    return null;
  }
}

function hasFinishReason(payload: unknown): boolean {
  if (!isObjectRecord(payload) || !Array.isArray(payload.choices)) return false;
  return payload.choices.some(
    (choice) =>
      isObjectRecord(choice) &&
      Object.hasOwn(choice, 'finish_reason') &&
      choice.finish_reason !== null &&
      choice.finish_reason !== undefined,
  );
}

function terminalChunk(model: string): string {
  return formatSSE({ delta: {}, finish_reason: 'stop' }, model);
}

function streamErrorChunk(message: string): string {
  return `data: ${JSON.stringify({
    error: {
      message,
      type: 'upstream_error',
    },
  })}\n\n`;
}

function normalizePayload(payload: string, markTerminalSeen: () => void): string | null {
  if (!payload || payload === '[DONE]') return null;

  const parsed = parseJsonPayload(payload);
  if (parsed === null) {
    return streamErrorChunk('Provider returned a non-JSON stream event.');
  }

  if (hasFinishReason(parsed)) {
    markTerminalSeen();
  }

  return `data: ${payload}\n\n`;
}

function normalizeSseText(sseText: string, markTerminalSeen: () => void): string | null {
  const frames = sseText
    .split(/\r?\n\r?\n/)
    .map((frame) => frame.trim())
    .filter(Boolean);
  const out: string[] = [];

  for (const frame of frames) {
    const payload = extractJsonPayload(frame);
    const normalized = normalizePayload(payload, markTerminalSeen);
    if (normalized) out.push(normalized);
  }

  return out.length > 0 ? out.join('') : null;
}

export function createOpenAiChatCompletionStreamNormalizer(
  model: string,
): OpenAiChatCompletionStreamNormalizer {
  let terminalSeen = false;
  const markTerminalSeen = () => {
    terminalSeen = true;
  };

  return {
    transform(chunk: string): string | null {
      const payload = extractJsonPayload(chunk);
      return normalizePayload(payload, markTerminalSeen);
    },

    finalize(): string | null {
      return `${terminalSeen ? '' : terminalChunk(model)}data: [DONE]\n\n`;
    },
  };
}

export function createOpenAiChatCompletionTerminalGuard(
  model: string,
): OpenAiChatCompletionTerminalGuard {
  let terminalSeen = false;
  const markTerminalSeen = () => {
    terminalSeen = true;
  };

  return {
    transform(sseText: string | null): string | null {
      if (!sseText) return null;
      return normalizeSseText(sseText, markTerminalSeen);
    },

    finalize(): string | null {
      return `${terminalSeen ? '' : terminalChunk(model)}data: [DONE]\n\n`;
    },
  };
}
