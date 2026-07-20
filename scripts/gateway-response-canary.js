'use strict';

const { createHash } = require('node:crypto');

const DEFAULT_MARKER = 'MANIFEST_GATEWAY_CANARY_OK';
const DEFAULT_TIMEOUT_MS = 100_000;

class CanaryError extends Error {
  constructor(code, evidence = {}) {
    super(code);
    this.name = 'CanaryError';
    this.code = code;
    this.evidence = evidence;
  }
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function emptyEvidence() {
  return {
    source_events: 0,
    content_blocks: 0,
    text_characters: 0,
    thinking_characters: 0,
    tool_calls: 0,
    tool_argument_characters: 0,
    malformed_events: 0,
    output_tokens: null,
    terminal_event: null,
    stop_reason: null,
    response_model: null,
  };
}

function createSseParser(onEvent) {
  let buffer = '';

  const consume = (final = false) => {
    while (true) {
      const match = buffer.match(/\r?\n\r?\n/);
      if (!match || match.index === undefined) break;
      const block = buffer.slice(0, match.index);
      buffer = buffer.slice(match.index + match[0].length);
      parseSseBlock(block, onEvent);
    }
    if (final && buffer.trim()) parseSseBlock(buffer, onEvent);
    if (final) buffer = '';
  };

  return {
    push(chunk) {
      buffer += chunk;
      consume(false);
    },
    finish() {
      consume(true);
    },
  };
}

function parseSseBlock(block, onEvent) {
  let event = 'message';
  const dataLines = [];
  for (const line of block.split(/\r?\n/)) {
    if (!line || line.startsWith(':')) continue;
    if (line.startsWith('event:')) event = line.slice(6).trim();
    if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
  }
  if (dataLines.length > 0) onEvent({ event, data: dataLines.join('\n') });
}

function inspectAnthropicEvent(rawEvent, state) {
  state.evidence.source_events += 1;

  let payload;
  try {
    payload = JSON.parse(rawEvent.data);
  } catch {
    state.evidence.malformed_events += 1;
    throw new CanaryError('malformed_sse_json', state.evidence);
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    state.evidence.malformed_events += 1;
    throw new CanaryError('malformed_sse_payload', state.evidence);
  }

  const type = typeof payload.type === 'string' ? payload.type : rawEvent.event;
  if (state.sawTerminal) throw new CanaryError('event_after_terminal', state.evidence);

  if (type === 'message_start') {
    if (state.sawMessageStart) throw new CanaryError('duplicate_message_start', state.evidence);
    state.sawMessageStart = true;
    if (payload.message && typeof payload.message === 'object') {
      state.evidence.response_model =
        typeof payload.message.model === 'string' ? payload.message.model : null;
    }
    return;
  }

  if (type === 'content_block_start') {
    const index = typeof payload.index === 'number' ? payload.index : -1;
    if (index < 0 || state.openBlocks.has(index)) {
      throw new CanaryError('invalid_content_block_start', state.evidence);
    }
    state.openBlocks.add(index);
    state.evidence.content_blocks += 1;
    if (
      payload.content_block &&
      typeof payload.content_block === 'object' &&
      payload.content_block.type === 'tool_use'
    ) {
      state.evidence.tool_calls += 1;
    }
    return;
  }

  if (type === 'content_block_delta' && payload.delta && typeof payload.delta === 'object') {
    const index = typeof payload.index === 'number' ? payload.index : -1;
    if (!state.openBlocks.has(index)) {
      throw new CanaryError('unexpected_content_block_delta', state.evidence);
    }
    if (typeof payload.delta.text === 'string') {
      state.textParts.push(payload.delta.text);
      state.evidence.text_characters += payload.delta.text.length;
    }
    if (typeof payload.delta.thinking === 'string') {
      state.evidence.thinking_characters += payload.delta.thinking.length;
    }
    if (typeof payload.delta.partial_json === 'string') {
      state.evidence.tool_argument_characters += payload.delta.partial_json.length;
    }
    return;
  }

  if (type === 'content_block_stop') {
    const index = typeof payload.index === 'number' ? payload.index : -1;
    if (!state.openBlocks.delete(index)) {
      throw new CanaryError('unexpected_content_block_stop', state.evidence);
    }
    return;
  }

  if (type === 'message_delta') {
    state.sawMessageDelta = true;
    if (payload.delta && typeof payload.delta === 'object') {
      state.evidence.stop_reason =
        typeof payload.delta.stop_reason === 'string' ? payload.delta.stop_reason : null;
    }
    if (payload.usage && typeof payload.usage.output_tokens === 'number') {
      state.evidence.output_tokens = payload.usage.output_tokens;
    }
    return;
  }

  if (type === 'error') {
    state.sawTerminal = true;
    state.evidence.terminal_event = 'error';
    throw new CanaryError('anthropic_error_event', state.evidence);
  }

  if (type === 'message_stop') {
    state.sawTerminal = true;
    state.evidence.terminal_event = 'message_stop';
  }
}

function validateCanaryResult(state, expectedText) {
  const actualText = state.textParts.join('');
  const evidence = {
    ...state.evidence,
    expected_characters: expectedText.length,
    expected_sha256: sha256(expectedText),
    actual_sha256: sha256(actualText),
  };

  if (!state.sawMessageStart) throw new CanaryError('missing_message_start', evidence);
  if (state.openBlocks.size > 0) throw new CanaryError('incomplete_content_block', evidence);
  if (!state.sawMessageDelta) throw new CanaryError('missing_message_delta', evidence);
  if (state.evidence.terminal_event !== 'message_stop') {
    throw new CanaryError('missing_message_stop', evidence);
  }
  if (!state.evidence.stop_reason) throw new CanaryError('missing_stop_reason', evidence);
  if (!(state.evidence.output_tokens > 0)) throw new CanaryError('missing_output_usage', evidence);
  if (actualText !== expectedText) throw new CanaryError('unexpected_text_digest', evidence);
  return evidence;
}

async function runCanary(options) {
  const {
    baseUrl,
    apiKey,
    model = 'default',
    marker = DEFAULT_MARKER,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    fetchImpl = globalThis.fetch,
  } = options;
  if (!baseUrl) throw new CanaryError('missing_base_url');
  if (!apiKey) throw new CanaryError('missing_api_key');
  if (typeof fetchImpl !== 'function') throw new CanaryError('fetch_unavailable');
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new CanaryError('invalid_timeout');
  }

  let url;
  try {
    url = new URL('/v1/messages', baseUrl);
  } catch {
    throw new CanaryError('invalid_base_url');
  }
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': apiKey,
        'user-agent': 'manifest-gateway-response-canary/1.0',
      },
      body: JSON.stringify({
        model,
        max_tokens: 64,
        stream: true,
        messages: [
          {
            role: 'user',
            content: `Reply with exactly ${marker} and no other text.`,
          },
        ],
      }),
      signal: controller.signal,
    });

    const traceId = response.headers.get('x-manifest-trace-id');
    const baseEvidence = {
      status: response.status,
      duration_ms: Date.now() - startedAt,
      trace_id: traceId,
      request_model: model,
    };
    if (!response.ok) {
      await response.body?.cancel();
      throw new CanaryError('unexpected_http_status', baseEvidence);
    }
    if (!/^[0-9a-f]{32}$/i.test(traceId ?? '')) {
      await response.body?.cancel();
      throw new CanaryError('missing_trace_id', baseEvidence);
    }
    if (!response.body) throw new CanaryError('empty_http_body', baseEvidence);

    const state = {
      evidence: emptyEvidence(),
      textParts: [],
      openBlocks: new Set(),
      sawMessageStart: false,
      sawMessageDelta: false,
      sawTerminal: false,
    };
    const parser = createSseParser((event) => inspectAnthropicEvent(event, state));
    const decoder = new TextDecoder();
    for await (const chunk of response.body) parser.push(decoder.decode(chunk, { stream: true }));
    parser.push(decoder.decode());
    parser.finish();

    return {
      ok: true,
      check: 'anthropic_messages_exact_text',
      ...baseEvidence,
      duration_ms: Date.now() - startedAt,
      ...validateCanaryResult(state, marker),
    };
  } catch (error) {
    if (error instanceof CanaryError) {
      throw new CanaryError(error.code, {
        status: response?.status ?? null,
        duration_ms: Date.now() - startedAt,
        trace_id: response?.headers.get('x-manifest-trace-id') ?? null,
        request_model: model,
        ...error.evidence,
      });
    }
    throw new CanaryError(controller.signal.aborted ? 'timeout' : 'transport_error', {
      status: response?.status ?? null,
      duration_ms: Date.now() - startedAt,
      trace_id: response?.headers.get('x-manifest-trace-id') ?? null,
      error_name: error instanceof Error ? error.name : 'unknown',
    });
  } finally {
    clearTimeout(timeout);
  }
}

function failureReport(error) {
  if (error instanceof CanaryError) {
    return {
      ok: false,
      check: 'anthropic_messages_exact_text',
      error_code: error.code,
      ...error.evidence,
    };
  }
  return {
    ok: false,
    check: 'anthropic_messages_exact_text',
    error_code: 'unexpected_canary_failure',
  };
}

async function main() {
  try {
    const result = await runCanary({
      baseUrl: process.env.MANIFEST_CANARY_BASE_URL,
      apiKey: process.env.MANIFEST_CANARY_API_KEY,
      model: process.env.MANIFEST_CANARY_MODEL || 'default',
      timeoutMs: Number(process.env.MANIFEST_CANARY_TIMEOUT_MS || DEFAULT_TIMEOUT_MS),
    });
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(`${JSON.stringify(failureReport(error))}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) void main();

module.exports = {
  DEFAULT_MARKER,
  CanaryError,
  createSseParser,
  inspectAnthropicEvent,
  validateCanaryResult,
  runCanary,
  failureReport,
  sha256,
};
