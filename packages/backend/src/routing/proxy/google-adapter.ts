/**
 * Converts between OpenAI chat completion format and Google Gemini format.
 * Only used when the resolved provider is Google; all other providers
 * accept the OpenAI format directly.
 */

import { randomUUID } from 'crypto';

interface OpenAIMessage {
  role: string;
  content?: unknown;
  [key: string]: unknown;
}

interface GeminiContent {
  role: string;
  parts: GeminiPart[];
}

interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
}

/* ── Request conversion ── */

function mapRole(role: string): string {
  if (role === 'assistant') return 'model';
  if (role === 'system') return 'user'; // Gemini treats system as user
  return 'user';
}

function messageToContent(msg: OpenAIMessage): GeminiContent | null {
  if (msg.role === 'system') {
    // System messages become user parts
    const text = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
    return { role: 'user', parts: [{ text }] };
  }

  const parts: GeminiPart[] = [];

  if (typeof msg.content === 'string') {
    parts.push({ text: msg.content });
  } else if (Array.isArray(msg.content)) {
    for (const block of msg.content as Array<Record<string, unknown>>) {
      if (block.type === 'text' && typeof block.text === 'string') {
        parts.push({ text: block.text });
      }
    }
  }

  // Handle tool calls from assistant
  if (Array.isArray(msg.tool_calls)) {
    for (const tc of msg.tool_calls as Array<Record<string, unknown>>) {
      const fn = tc.function as { name: string; arguments: string } | undefined;
      if (fn) {
        parts.push({
          functionCall: {
            name: fn.name,
            args: JSON.parse(fn.arguments || '{}'),
          },
        });
      }
    }
  }

  // Handle tool response
  if (msg.role === 'tool' && typeof msg.content === 'string') {
    return {
      role: 'user',
      parts: [{
        functionResponse: {
          name: (msg.tool_call_id as string) || 'unknown',
          response: { result: msg.content },
        },
      }],
    };
  }

  if (parts.length === 0) return null;
  return { role: mapRole(msg.role), parts };
}

function convertTools(tools?: Record<string, unknown>[]): Record<string, unknown>[] | undefined {
  if (!tools || tools.length === 0) return undefined;

  const declarations = tools.map((t) => {
    const fn = t.function as { name: string; description?: string; parameters?: unknown } | undefined;
    if (!fn) return null;
    return {
      name: fn.name,
      description: fn.description,
      parameters: fn.parameters,
    };
  }).filter(Boolean);

  if (declarations.length === 0) return undefined;
  return [{ functionDeclarations: declarations }];
}

export function toGoogleRequest(
  body: Record<string, unknown>,
  _model: string,
): Record<string, unknown> {
  const messages = (body.messages as OpenAIMessage[]) || [];
  const contents: GeminiContent[] = [];

  // Extract system instruction
  const systemMsgs = messages.filter((m) => m.role === 'system');
  const systemText = systemMsgs
    .map((m) => (typeof m.content === 'string' ? m.content : ''))
    .filter(Boolean)
    .join('\n');

  for (const msg of messages) {
    if (msg.role === 'system') continue;
    const content = messageToContent(msg);
    if (content) contents.push(content);
  }

  const result: Record<string, unknown> = { contents };

  if (systemText) {
    result.systemInstruction = { parts: [{ text: systemText }] };
  }

  const tools = convertTools(body.tools as Record<string, unknown>[] | undefined);
  if (tools) result.tools = tools;

  // Map generation config
  const genConfig: Record<string, unknown> = {};
  if (body.max_tokens !== undefined) genConfig.maxOutputTokens = body.max_tokens;
  if (body.temperature !== undefined) genConfig.temperature = body.temperature;
  if (body.top_p !== undefined) genConfig.topP = body.top_p;
  if (Object.keys(genConfig).length > 0) result.generationConfig = genConfig;

  return result;
}

/* ── Response conversion ── */

export function fromGoogleResponse(
  googleResp: Record<string, unknown>,
  model: string,
): Record<string, unknown> {
  const candidates = (googleResp.candidates as Array<Record<string, unknown>>) || [];
  const candidate = candidates[0];

  if (!candidate) {
    return {
      id: `chatcmpl-${randomUUID()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [],
    };
  }

  const content = candidate.content as { parts?: Array<Record<string, unknown>> } | undefined;
  const parts = content?.parts || [];

  let textContent = '';
  const toolCalls: Record<string, unknown>[] = [];

  for (const part of parts) {
    if (part.text) textContent += part.text;
    if (part.functionCall) {
      const fc = part.functionCall as { name: string; args: Record<string, unknown> };
      toolCalls.push({
        id: `call_${randomUUID()}`,
        type: 'function',
        function: { name: fc.name, arguments: JSON.stringify(fc.args) },
      });
    }
  }

  const message: Record<string, unknown> = { role: 'assistant', content: textContent || null };
  if (toolCalls.length > 0) message.tool_calls = toolCalls;

  const usage = googleResp.usageMetadata as Record<string, number> | undefined;

  return {
    id: `chatcmpl-${randomUUID()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, message, finish_reason: mapFinishReason(candidate) }],
    usage: usage
      ? {
          prompt_tokens: usage.promptTokenCount ?? 0,
          completion_tokens: usage.candidatesTokenCount ?? 0,
          total_tokens: usage.totalTokenCount ?? 0,
        }
      : undefined,
  };
}

function mapFinishReason(candidate: Record<string, unknown>): string {
  const reason = candidate.finishReason as string | undefined;
  if (!reason) return 'stop';
  const map: Record<string, string> = {
    STOP: 'stop',
    MAX_TOKENS: 'length',
    SAFETY: 'content_filter',
    RECITATION: 'content_filter',
  };
  return map[reason] ?? 'stop';
}

/* ── Stream chunk conversion ── */

export function transformGoogleStreamChunk(
  chunk: string,
  model: string,
): string | null {
  if (!chunk.trim()) return null;

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(chunk);
  } catch {
    return null;
  }

  const candidates = (data.candidates as Array<Record<string, unknown>>) || [];
  const candidate = candidates[0];
  if (!candidate) return null;

  const content = candidate.content as { parts?: Array<Record<string, unknown>> } | undefined;
  const parts = content?.parts || [];
  const text = parts.map((p) => p.text || '').join('');

  if (!text) return null;

  const sseData = {
    id: `chatcmpl-${randomUUID()}`,
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, delta: { content: text }, finish_reason: null }],
  };

  return `data: ${JSON.stringify(sseData)}\n\n`;
}
