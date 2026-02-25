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
} from "@opentelemetry/api";
import { SPANS, METRICS, ATTRS } from "./constants";
import { ManifestConfig } from "./config";
import { PluginLogger } from "./telemetry";
import { resolveRouting } from "./routing";

interface ActiveSpans {
  root: Span;
  turn?: Span;
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
    description: "Total LLM inference requests",
  });
  llmTokensInput = meter.createCounter(METRICS.LLM_TOKENS_INPUT, {
    description: "Total input tokens sent to LLM",
  });
  llmTokensOutput = meter.createCounter(METRICS.LLM_TOKENS_OUTPUT, {
    description: "Total output tokens from LLM",
  });
  llmTokensCacheRead = meter.createCounter(METRICS.LLM_TOKENS_CACHE_READ, {
    description: "Total cache-read tokens",
  });
  llmDuration = meter.createHistogram(METRICS.LLM_DURATION, {
    description: "LLM request duration in ms",
    unit: "ms",
  });
  toolCalls = meter.createCounter(METRICS.TOOL_CALLS, {
    description: "Total tool invocations",
  });
  toolErrors = meter.createCounter(METRICS.TOOL_ERRORS, {
    description: "Total tool errors",
  });
  toolDuration = meter.createHistogram(METRICS.TOOL_DURATION, {
    description: "Tool execution duration in ms",
    unit: "ms",
  });
  messagesReceived = meter.createCounter(METRICS.MESSAGES_RECEIVED, {
    description: "Total messages received from users",
  });
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function registerHooks(
  api: any,
  tracer: Tracer,
  config: ManifestConfig,
  logger: PluginLogger,
): void {
  // --- message_received ---
  // Creates the root span for the entire request lifecycle.
  api.on("message_received", (event: any) => {
    const sessionKey =
      event.sessionKey || event.session?.key || `agent:${event.agent || "main"}:main`;
    const channel = event.channel || "unknown";

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
  api.on("before_agent_start", (event: any) => {
    const sessionKey =
      event.sessionKey ||
      event.session?.key ||
      `agent:${event.agent || "main"}:main`;
    const agentName = event.agent || "main";

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

    logger.debug(
      `[manifest] Agent turn started: agent=${agentName}, session=${sessionKey}`,
    );
  });

  // --- tool_result_persist ---
  // Records tool metrics and creates a child span.
  api.on("tool_result_persist", (event: any) => {
    const toolName = event.toolName || event.tool || "unknown";
    const durationMs = event.durationMs || 0;
    const success = event.error == null;
    const sessionKey = event.sessionKey || "unknown";

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
        message: event.error?.message || "Tool execution failed",
      });
      toolErrors.add(1, { [ATTRS.TOOL_NAME]: toolName });
    }
    toolSpan.end();

    toolCalls.add(1, { [ATTRS.TOOL_NAME]: toolName });
    toolDuration.record(durationMs, { [ATTRS.TOOL_NAME]: toolName });
  });

  // --- agent_end ---
  // Records LLM metrics and closes all spans.
  // Event shape: { messages: Message[], success: boolean, durationMs: number }
  // Usage data lives on each assistant message, not at the top level.
  api.on("agent_end", async (event: any) => {
    const sessionKey =
      event.sessionKey ||
      event.session?.key ||
      `agent:${event.agent || "main"}:main`;

    // Extract data from the last assistant message with usage info
    const messages: any[] = event.messages || [];
    const lastAssistant = [...messages]
      .reverse()
      .find((m: any) => m.role === "assistant" && m.usage);

    const model = lastAssistant?.model || event.model || "unknown";
    const provider = lastAssistant?.provider || event.provider || "unknown";
    const usage = lastAssistant?.usage || event.usage || {};
    const inputTokens = usage.input || usage.inputTokens || 0;
    const outputTokens = usage.output || usage.outputTokens || 0;
    const cacheReadTokens = usage.cacheRead || usage.cacheReadTokens || 0;
    const cacheWriteTokens = usage.cacheWrite || usage.cacheWriteTokens || 0;

    // If model is "auto" (routed through manifest proxy), resolve the actual model
    let finalModel = model;
    let finalProvider = provider;
    let routingTier: string | null = null;

    if (finalModel === "auto" && config.mode !== "cloud") {
      const resolved = await resolveRouting(config, messages, sessionKey, logger);
      if (resolved) {
        finalModel = resolved.model;
        finalProvider = resolved.provider;
        routingTier = resolved.tier;
      }
    }

    const active = activeSpans.get(sessionKey);

    if (active?.turn) {
      active.turn.setAttributes({
        [ATTRS.MODEL]: finalModel,
        [ATTRS.PROVIDER]: finalProvider,
        [ATTRS.INPUT_TOKENS]: inputTokens,
        [ATTRS.OUTPUT_TOKENS]: outputTokens,
        [ATTRS.CACHE_READ_TOKENS]: cacheReadTokens,
        [ATTRS.CACHE_WRITE_TOKENS]: cacheWriteTokens,
      });
      if (routingTier) {
        active.turn.setAttribute(ATTRS.ROUTING_TIER, routingTier);
      }
      active.turn.end();
    }

    if (active?.root && active.root !== active.turn) {
      active.root.end();
    }
    activeSpans.delete(sessionKey);

    const metricAttrs = {
      [ATTRS.MODEL]: finalModel,
      [ATTRS.PROVIDER]: finalProvider,
    };
    llmRequests.add(1, metricAttrs);
    llmTokensInput.add(inputTokens, metricAttrs);
    llmTokensOutput.add(outputTokens, metricAttrs);
    if (cacheReadTokens > 0) {
      llmTokensCacheRead.add(cacheReadTokens, metricAttrs);
    }

    logger.debug(
      `[manifest] agent_end tokens: in=${inputTokens}, out=${outputTokens}, cache=${cacheReadTokens}`,
    );
    logger.debug(`[manifest] Trace completed for session=${sessionKey}`);
  });

  logger.debug("[manifest] All hooks registered");
}
