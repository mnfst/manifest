import {
  SpanKind,
  SpanStatusCode,
  context,
  trace as traceApi,
  Span,
  Tracer,
  Meter,
  Counter,
  Histogram,
} from '@opentelemetry/api';
import { SPANS, METRICS, ATTRS } from './constants';
import { ManifestConfig } from './config';
import { PluginLogger } from './telemetry';
import { resolveRouting } from './routing';

interface ActiveSpans {
  root: Span;
  turn?: Span;
  llmOutput?: LlmUsageSnapshot;
  pendingEnd?: PendingAgentEnd;
}

interface LlmUsageSnapshot {
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

interface PendingAgentEnd {
  messages: any[];
  success?: boolean;
  error?: any;
  errorMessage?: any;
  durationMs?: number;
  fallbackUsage: LlmUsageSnapshot;
}

// In-flight span tracking (keyed by session)
const activeSpans = new Map<string, ActiveSpans>();

// Metrics instruments (initialized once)
let llmRequests: Counter;
let llmTokensInput: Counter;
let llmTokensOutput: Counter;
let llmTokensCacheRead: Counter;
let llmDuration: Histogram;
let toolCalls: Counter;
let toolErrors: Counter;
let toolDuration: Histogram;
let messagesReceived: Counter;

export function initMetrics(meter: Meter): void {
  llmRequests = meter.createCounter(METRICS.LLM_REQUESTS, {
    description: 'Total LLM inference requests',
  });
  llmTokensInput = meter.createCounter(METRICS.LLM_TOKENS_INPUT, {
    description: 'Total input tokens sent to LLM',
  });
  llmTokensOutput = meter.createCounter(METRICS.LLM_TOKENS_OUTPUT, {
    description: 'Total output tokens from LLM',
  });
  llmTokensCacheRead = meter.createCounter(METRICS.LLM_TOKENS_CACHE_READ, {
    description: 'Total cache-read tokens',
  });
  llmDuration = meter.createHistogram(METRICS.LLM_DURATION, {
    description: 'LLM request duration in ms',
    unit: 'ms',
  });
  toolCalls = meter.createCounter(METRICS.TOOL_CALLS, {
    description: 'Total tool invocations',
  });
  toolErrors = meter.createCounter(METRICS.TOOL_ERRORS, {
    description: 'Total tool errors',
  });
  toolDuration = meter.createHistogram(METRICS.TOOL_DURATION, {
    description: 'Tool execution duration in ms',
    unit: 'ms',
  });
  messagesReceived = meter.createCounter(METRICS.MESSAGES_RECEIVED, {
    description: 'Total messages received from users',
  });
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Register an event handler using the best available gateway API.
 * Current gateways (v2026.2.x) dispatch via api.on(); newer versions
 * may use api.registerHook() with metadata. Try api.on() first since
 * it's confirmed to work, fall back to registerHook() for forward compat.
 */
function hookOn(api: any, event: string, handler: (...args: any[]) => any): void {
  if (typeof api.on === 'function') {
    api.on(event, handler);
  } else if (typeof api.registerHook === 'function') {
    api.registerHook(event, handler);
  }
}

function getSessionKey(event: any, ctx?: any): string {
  return (
    event?.sessionKey ||
    event?.session?.key ||
    ctx?.sessionKey ||
    (ctx?.sessionId ? `session:${ctx.sessionId}` : undefined) ||
    (event?.sessionId ? `session:${event.sessionId}` : undefined) ||
    `agent:${event?.agent || 'main'}:main`
  );
}

function extractUsage(
  usage: any,
): Pick<LlmUsageSnapshot, 'inputTokens' | 'outputTokens' | 'cacheReadTokens' | 'cacheWriteTokens'> {
  const promptDetails = usage?.prompt_tokens_details || {};

  return {
    inputTokens:
      usage?.input ||
      usage?.inputTokens ||
      usage?.input_tokens ||
      usage?.prompt_tokens ||
      usage?.promptTokens ||
      0,
    outputTokens:
      usage?.output ||
      usage?.outputTokens ||
      usage?.output_tokens ||
      usage?.completion_tokens ||
      usage?.completionTokens ||
      0,
    cacheReadTokens:
      usage?.cacheRead ||
      usage?.cacheReadTokens ||
      usage?.cache_read_tokens ||
      usage?.cache_read_input_tokens ||
      usage?.cached_input_tokens ||
      promptDetails.cached_tokens ||
      0,
    cacheWriteTokens:
      usage?.cacheWrite ||
      usage?.cacheWriteTokens ||
      usage?.cache_creation_tokens ||
      usage?.cache_write_input_tokens ||
      0,
  };
}

function hasUsageTokens(
  usage: Pick<
    LlmUsageSnapshot,
    'inputTokens' | 'outputTokens' | 'cacheReadTokens' | 'cacheWriteTokens'
  >,
): boolean {
  return (
    usage.inputTokens > 0 ||
    usage.outputTokens > 0 ||
    usage.cacheReadTokens > 0 ||
    usage.cacheWriteTokens > 0
  );
}

function extractAgentEndUsage(event: any): {
  snapshot: LlmUsageSnapshot;
  hasUsableUsage: boolean;
} {
  const messages: any[] = event.messages || [];
  const lastAssistant = [...messages]
    .reverse()
    .find((m: any) => m?.role === 'assistant' && m.usage);
  const usage = extractUsage(lastAssistant?.usage || event.usage || {});
  const snapshot = {
    model: lastAssistant?.model || event.model || 'unknown',
    provider: lastAssistant?.provider || event.provider || 'unknown',
    ...usage,
  };

  return {
    snapshot,
    hasUsableUsage: hasUsageTokens(usage),
  };
}

function extractLlmOutputUsage(event: any): LlmUsageSnapshot {
  const lastAssistant = event.lastAssistant;
  const usage = lastAssistant?.usage || event.usage || {};

  return {
    model: lastAssistant?.model || event.model || 'unknown',
    provider: lastAssistant?.provider || event.provider || 'unknown',
    ...extractUsage(usage),
  };
}

export function registerHooks(
  api: any,
  tracer: Tracer,
  config: ManifestConfig,
  logger: PluginLogger,
): void {
  const finalizeTrace = async (sessionKey: string, active: ActiveSpans): Promise<void> => {
    const pendingEnd = active.pendingEnd;
    if (!pendingEnd) return;

    const usage = active.llmOutput || pendingEnd.fallbackUsage;
    let finalModel = usage.model;
    let finalProvider = usage.provider;
    let routingTier: string | null = null;
    let routingReason: string | null = null;

    if (finalModel === 'auto') {
      const resolved = await resolveRouting(config, pendingEnd.messages, sessionKey, logger);
      if (resolved) {
        finalModel = resolved.model;
        finalProvider = resolved.provider;
        routingTier = resolved.tier;
        routingReason = resolved.reason || null;
      }
    }

    // Detect heartbeat only from the last user message in the turn.
    const lastUserMsg = [...pendingEnd.messages].reverse().find((m: any) => m?.role === 'user');
    const hasHeartbeat = lastUserMsg
      ? typeof lastUserMsg.content === 'string'
        ? lastUserMsg.content.includes('HEARTBEAT_OK')
        : Array.isArray(lastUserMsg.content)
          ? lastUserMsg.content.some(
              (p: any) =>
                p.type === 'text' && typeof p.text === 'string' && p.text.includes('HEARTBEAT_OK'),
            )
          : false
      : false;
    if (hasHeartbeat) {
      routingReason = 'heartbeat';
      routingTier = 'simple';
    }

    if (active.turn) {
      active.turn.setAttributes({
        [ATTRS.MODEL]: finalModel,
        [ATTRS.PROVIDER]: finalProvider,
        [ATTRS.INPUT_TOKENS]: usage.inputTokens,
        [ATTRS.OUTPUT_TOKENS]: usage.outputTokens,
        [ATTRS.CACHE_READ_TOKENS]: usage.cacheReadTokens,
        [ATTRS.CACHE_WRITE_TOKENS]: usage.cacheWriteTokens,
      });
      if (routingTier) {
        active.turn.setAttribute(ATTRS.ROUTING_TIER, routingTier);
      }
      if (routingReason) {
        active.turn.setAttribute(ATTRS.ROUTING_REASON, routingReason);
      }
      if (pendingEnd.success === false || pendingEnd.error != null) {
        const errMsg = pendingEnd.error?.message || pendingEnd.errorMessage || 'Agent turn failed';
        active.turn.setStatus({
          code: SpanStatusCode.ERROR,
          message: typeof errMsg === 'string' ? errMsg.slice(0, 500) : String(errMsg),
        });
      }
      active.turn.end();
    }

    if (active.root && active.root !== active.turn) {
      active.root.end();
    }
    activeSpans.delete(sessionKey);

    const metricAttrs = {
      [ATTRS.MODEL]: finalModel,
      [ATTRS.PROVIDER]: finalProvider,
    };
    llmRequests.add(1, metricAttrs);
    llmTokensInput.add(usage.inputTokens, metricAttrs);
    llmTokensOutput.add(usage.outputTokens, metricAttrs);
    if (usage.cacheReadTokens > 0) {
      llmTokensCacheRead.add(usage.cacheReadTokens, metricAttrs);
    }
    if ((pendingEnd.durationMs || 0) > 0) {
      llmDuration.record(pendingEnd.durationMs || 0, metricAttrs);
    }

    logger.debug(
      `[manifest] agent_end tokens: in=${usage.inputTokens}, out=${usage.outputTokens}, cache=${usage.cacheReadTokens}`,
    );
    logger.debug(`[manifest] Trace completed for session=${sessionKey}`);
  };

  // --- message_received ---
  // Creates the root span for the entire request lifecycle.
  hookOn(api, 'message_received', (event: any) => {
    const sessionKey = getSessionKey(event);
    const channel = event.channel || 'unknown';

    const rootSpan = tracer.startSpan(SPANS.REQUEST, {
      kind: SpanKind.SERVER,
      attributes: {
        [ATTRS.SESSION_KEY]: sessionKey,
        [ATTRS.CHANNEL]: channel,
      },
    });

    activeSpans.set(sessionKey, { root: rootSpan });
    messagesReceived.add(1, { [ATTRS.CHANNEL]: channel });
    logger.debug(`[manifest] Root span started for session=${sessionKey}`);
  });

  // --- before_agent_start ---
  // Creates a child span under the root for the agent turn.
  hookOn(api, 'before_agent_start', (event: any) => {
    const sessionKey = getSessionKey(event);
    const agentName = event.agent || 'main';

    const active = activeSpans.get(sessionKey);
    const parentContext = active?.root
      ? traceApi.setSpan(context.active(), active.root)
      : context.active();

    const turnSpan = tracer.startSpan(
      SPANS.AGENT_TURN,
      {
        kind: SpanKind.INTERNAL,
        attributes: {
          [ATTRS.AGENT_NAME]: agentName,
          [ATTRS.SESSION_KEY]: sessionKey,
        },
      },
      parentContext,
    );

    if (active) {
      active.turn = turnSpan;
    } else {
      activeSpans.set(sessionKey, { root: turnSpan, turn: turnSpan });
    }

    logger.debug(`[manifest] Agent turn started: agent=${agentName}, session=${sessionKey}`);
  });

  // --- tool_result_persist ---
  // Records tool metrics and creates a child span.
  hookOn(api, 'tool_result_persist', (event: any) => {
    const toolName = event.toolName || event.tool || 'unknown';
    const durationMs = event.durationMs || 0;
    const success = event.error == null;
    const sessionKey = getSessionKey(event, { sessionKey: 'unknown' });

    const active = activeSpans.get(sessionKey);
    const parentContext = active?.turn
      ? traceApi.setSpan(context.active(), active.turn)
      : context.active();

    const toolSpan = tracer.startSpan(
      `${SPANS.TOOL_PREFIX}${toolName}`,
      {
        kind: SpanKind.INTERNAL,
        attributes: {
          [ATTRS.TOOL_NAME]: toolName,
          [ATTRS.TOOL_SUCCESS]: String(success),
          [ATTRS.SESSION_KEY]: sessionKey,
        },
      },
      parentContext,
    );

    if (!success) {
      toolSpan.setStatus({
        code: SpanStatusCode.ERROR,
        message: event.error?.message || 'Tool execution failed',
      });
      toolErrors.add(1, { [ATTRS.TOOL_NAME]: toolName });
    }
    toolSpan.end();

    toolCalls.add(1, { [ATTRS.TOOL_NAME]: toolName });
    toolDuration.record(durationMs, { [ATTRS.TOOL_NAME]: toolName });
  });

  // --- llm_output ---
  // Current OpenClaw versions emit normalized token usage here, after agent_end.
  hookOn(api, 'llm_output', async (event: any, ctx?: any) => {
    const sessionKey = getSessionKey(event, ctx);
    const active = activeSpans.get(sessionKey);
    if (!active) return;

    active.llmOutput = extractLlmOutputUsage(event);
    if (active.pendingEnd) {
      await finalizeTrace(sessionKey, active);
    }
  });

  // --- agent_end ---
  // Records routing/status and closes spans once token usage is available.
  hookOn(api, 'agent_end', async (event: any, ctx?: any) => {
    const sessionKey = getSessionKey(event, ctx);
    const active = activeSpans.get(sessionKey);
    if (!active) return;

    const { snapshot, hasUsableUsage } = extractAgentEndUsage(event);
    active.pendingEnd = {
      messages: event.messages || [],
      success: event.success,
      error: event.error,
      errorMessage: event.errorMessage,
      durationMs: event.durationMs,
      fallbackUsage: snapshot,
    };

    const shouldFinalizeImmediately =
      Boolean(active.llmOutput) ||
      hasUsableUsage ||
      event.success === false ||
      (event.messages || []).length === 0;

    if (shouldFinalizeImmediately) {
      await finalizeTrace(sessionKey, active);
    }
  });

  logger.debug('[manifest] All hooks registered');
}
