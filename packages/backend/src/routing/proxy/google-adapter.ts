/**
 * Converts between OpenAI chat completion format and Google Gemini format.
 * Only used when the resolved provider is Google; all other providers
 * accept the OpenAI format directly.
 */

import { randomUUID } from 'crypto';

import { OpenAIMessage, SignatureLookup } from './proxy-types';

interface GeminiContent {
  role: string;
  parts: GeminiPart[];
}

interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args: Record<string, unknown>; [key: string]: unknown };
  functionResponse?: { name: string; response: Record<string, unknown> };
}

/**
 * JSON Schema fields not supported by the Gemini API.
 * These must be stripped recursively before sending tool parameters.
 */
const UNSUPPORTED_SCHEMA_FIELDS = new Set([
  'patternProperties',
  'additionalProperties',
  '$schema',
  '$id',
  '$ref',
  '$defs',
  'definitions',
  'allOf',
  'anyOf',
  'oneOf',
  'not',
  'if',
  'then',
  'else',
  'dependentSchemas',
  'dependentRequired',
  'unevaluatedProperties',
  'unevaluatedItems',
  'contentMediaType',
  'contentEncoding',
  'examples',
  'default',
  'const',
  'title',
]);

function sanitizeSchema(schema: unknown, isPropertiesMap = false): unknown {
  if (schema === null || schema === undefined || typeof schema !== 'object') {
    return schema;
  }

  if (Array.isArray(schema)) {
    return schema.map((item) => sanitizeSchema(item));
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema as Record<string, unknown>)) {
    // Inside a `properties` map, keys are user-defined property names
    // (e.g. "title", "default"), not JSON Schema keywords — keep them all.
    // Their values are sub-schemas, so recurse normally (not as properties map).
    if (!isPropertiesMap && UNSUPPORTED_SCHEMA_FIELDS.has(key)) continue;
    result[key] = sanitizeSchema(value, key === 'properties');
  }
  return result;
}

function safeParseArgs(args: string | undefined): Record<string, unknown> {
  try {
    return JSON.parse(args || '{}') as Record<string, unknown>;
  } catch {
    return {};
  }
}

/* ── Request conversion ── */

function mapRole(role: string): string {
  if (role === 'assistant') return 'model';
  if (role === 'system') return 'user'; // Gemini treats system as user
  return 'user';
}

function messageToContent(
  msg: OpenAIMessage,
  signatureLookup?: SignatureLookup,
): GeminiContent | null {
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
    for (const tc of msg.tool_calls) {
      const functionCall: GeminiPart['functionCall'] = {
        name: tc.function.name,
        args: safeParseArgs(tc.function.arguments),
      };
      // Preserve thought_signature from the client, or re-inject from cache
      const sig = (tc as Record<string, unknown>).thought_signature;
      if (sig) {
        functionCall!.thought_signature = sig;
      } else if (signatureLookup) {
        const cached = signatureLookup(tc.id);
        if (cached) functionCall!.thought_signature = cached;
      }
      parts.push({ functionCall });
    }
  }

  // Handle tool response
  if (msg.role === 'tool' && typeof msg.content === 'string') {
    return {
      role: 'user',
      parts: [
        {
          functionResponse: {
            name: (msg.tool_call_id as string) || 'unknown',
            response: { result: msg.content },
          },
        },
      ],
    };
  }

  if (parts.length === 0) return null;
  return { role: mapRole(msg.role), parts };
}

function convertTools(tools?: Record<string, unknown>[]): Record<string, unknown>[] | undefined {
  if (!tools || tools.length === 0) return undefined;

  const declarations = tools
    .map((t) => {
      const fn = t.function as
        | { name: string; description?: string; parameters?: unknown }
        | undefined;
      if (!fn) return null;
      return {
        name: fn.name,
        description: fn.description,
        parameters: fn.parameters ? sanitizeSchema(fn.parameters) : undefined,
      };
    })
    .filter(Boolean);

  if (declarations.length === 0) return undefined;
  return [{ functionDeclarations: declarations }];
}

/** Extracted thought_signature entries from a Gemini response. */
export interface ExtractedSignature {
  toolCallId: string;
  signature: string;
}

export function toGoogleRequest(
  body: Record<string, unknown>,
  _model: string,
  signatureLookup?: SignatureLookup,
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
    const content = messageToContent(msg, signatureLookup);
    if (content) contents.push(content);
  }

  const result: Record<string, unknown> = { contents };

  if (systemText) {
    result.systemInstruction = {
      parts: [{ text: systemText }],
    };
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
): Record<string, unknown> & { _extractedSignatures?: ExtractedSignature[] } {
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
      const fc = part.functionCall as {
        name: string;
        args: Record<string, unknown>;
        thought_signature?: string;
      };
      const toolCall: Record<string, unknown> = {
        id: `call_${randomUUID()}`,
        type: 'function',
        function: { name: fc.name, arguments: JSON.stringify(fc.args) },
      };
      if (fc.thought_signature) toolCall.thought_signature = fc.thought_signature;
      toolCalls.push(toolCall);
    }
  }

  const message: Record<string, unknown> = { role: 'assistant', content: textContent || null };
  if (toolCalls.length > 0) message.tool_calls = toolCalls;

  // Extract thought_signatures for caching
  const extractedSignatures: ExtractedSignature[] = [];
  for (const tc of toolCalls) {
    if (tc.thought_signature && typeof tc.id === 'string') {
      extractedSignatures.push({
        toolCallId: tc.id as string,
        signature: tc.thought_signature as string,
      });
    }
  }

  const usage = googleResp.usageMetadata as Record<string, number> | undefined;

  return {
    id: `chatcmpl-${randomUUID()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      { index: 0, message, finish_reason: mapFinishReason(candidate, toolCalls.length > 0) },
    ],
    usage: usage
      ? {
          prompt_tokens: usage.promptTokenCount ?? 0,
          completion_tokens: usage.candidatesTokenCount ?? 0,
          total_tokens: usage.totalTokenCount ?? 0,
          prompt_tokens_details: { cached_tokens: usage.cachedContentTokenCount ?? 0 },
          cache_read_tokens: usage.cachedContentTokenCount ?? 0,
          cache_creation_tokens: 0,
        }
      : undefined,
    ...(extractedSignatures.length > 0 ? { _extractedSignatures: extractedSignatures } : {}),
  };
}

function mapFinishReason(candidate: Record<string, unknown>, hasToolCalls = false): string {
  const reason = candidate.finishReason as string | undefined;
  if (!reason || reason === 'STOP') {
    return hasToolCalls ? 'tool_calls' : 'stop';
  }
  const map: Record<string, string> = {
    MAX_TOKENS: 'length',
    SAFETY: 'content_filter',
    RECITATION: 'content_filter',
  };
  return map[reason] ?? 'stop';
}

/* ── Stream chunk conversion ── */

export function transformGoogleStreamChunk(chunk: string, model: string): string | null {
  if (!chunk.trim()) return null;

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(chunk);
  } catch {
    return null;
  }

  const candidates = (data.candidates as Array<Record<string, unknown>>) || [];
  const candidate = candidates[0];
  const content = candidate?.content as { parts?: Array<Record<string, unknown>> } | undefined;
  const parts = content?.parts || [];
  const text = parts.map((p) => p.text || '').join('');

  const toolCalls: Record<string, unknown>[] = [];
  for (const part of parts) {
    if (part.functionCall) {
      const fc = part.functionCall as {
        name: string;
        args?: Record<string, unknown>;
        thought_signature?: string;
      };
      const toolCall: Record<string, unknown> = {
        index: toolCalls.length,
        id: `call_${randomUUID()}`,
        type: 'function',
        function: { name: fc.name, arguments: JSON.stringify(fc.args ?? {}) },
      };
      if (fc.thought_signature) toolCall.thought_signature = fc.thought_signature;
      toolCalls.push(toolCall);
    }
  }

  let result = '';

  if (text || toolCalls.length > 0) {
    const delta: Record<string, unknown> = {};
    if (text) delta.content = text;
    if (toolCalls.length > 0) delta.tool_calls = toolCalls;
    result += `data: ${JSON.stringify({
      id: `chatcmpl-${randomUUID()}`,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [{ index: 0, delta, finish_reason: null }],
    })}\n\n`;
  }

  const usage = data.usageMetadata as Record<string, number> | undefined;
  if (usage) {
    const finishReason = mapFinishReason(candidate ?? {}, toolCalls.length > 0);
    result += `data: ${JSON.stringify({
      id: `chatcmpl-${randomUUID()}`,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [{ index: 0, delta: {}, finish_reason: finishReason }],
    })}\n\n`;
    result += `data: ${JSON.stringify({
      id: `chatcmpl-${randomUUID()}`,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [],
      usage: {
        prompt_tokens: usage.promptTokenCount ?? 0,
        completion_tokens: usage.candidatesTokenCount ?? 0,
        total_tokens: usage.totalTokenCount ?? 0,
        prompt_tokens_details: { cached_tokens: usage.cachedContentTokenCount ?? 0 },
        cache_read_tokens: usage.cachedContentTokenCount ?? 0,
        cache_creation_tokens: 0,
      },
    })}\n\n`;
  }

  return result || null;
}
