import { SpanKind, SpanStatusCode } from "@opentelemetry/api";
import { initMetrics, registerHooks } from "../src/hooks";
import { SPANS, METRICS, ATTRS } from "../src/constants";
import { ManifestConfig } from "../src/config";

// --- Mock span ---
function createMockSpan() {
  return {
    setAttributes: jest.fn(),
    setStatus: jest.fn(),
    end: jest.fn(),
    spanContext: jest.fn(() => ({ traceId: "abc", spanId: "def" })),
  };
}

// --- Mock tracer ---
function createMockTracer() {
  const spans: ReturnType<typeof createMockSpan>[] = [];
  return {
    spans,
    startSpan: jest.fn((_name: string, _opts?: unknown, _ctx?: unknown) => {
      const span = createMockSpan();
      spans.push(span);
      return span;
    }),
  };
}

// --- Mock meter ---
function createMockMeter() {
  const counters = new Map<string, { add: jest.Mock }>();
  const histograms = new Map<string, { record: jest.Mock }>();
  return {
    counters,
    histograms,
    createCounter: jest.fn((name: string) => {
      const c = { add: jest.fn() };
      counters.set(name, c);
      return c;
    }),
    createHistogram: jest.fn((name: string) => {
      const h = { record: jest.fn() };
      histograms.set(name, h);
      return h;
    }),
  };
}

// --- Mock API (event emitter) ---
function createMockApi() {
  const handlers = new Map<string, (event: unknown) => void>();
  return {
    handlers,
    on: jest.fn((event: string, handler: (event: unknown) => void) => {
      handlers.set(event, handler);
    }),
    emit(event: string, data: unknown) {
      handlers.get(event)?.(data);
    },
  };
}

const mockLogger = {
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

const config: ManifestConfig = {
  apiKey: "mnfst_test",
  endpoint: "http://localhost:3001/otlp",
  serviceName: "test",
  captureContent: false,
  metricsIntervalMs: 30000,
};

describe("initMetrics", () => {
  it("creates all expected counters and histograms", () => {
    const meter = createMockMeter();
    initMetrics(meter as any);

    expect(meter.createCounter).toHaveBeenCalledWith(
      METRICS.LLM_REQUESTS,
      expect.any(Object),
    );
    expect(meter.createCounter).toHaveBeenCalledWith(
      METRICS.LLM_TOKENS_INPUT,
      expect.any(Object),
    );
    expect(meter.createCounter).toHaveBeenCalledWith(
      METRICS.LLM_TOKENS_OUTPUT,
      expect.any(Object),
    );
    expect(meter.createCounter).toHaveBeenCalledWith(
      METRICS.LLM_TOKENS_CACHE_READ,
      expect.any(Object),
    );
    expect(meter.createCounter).toHaveBeenCalledWith(
      METRICS.TOOL_CALLS,
      expect.any(Object),
    );
    expect(meter.createCounter).toHaveBeenCalledWith(
      METRICS.TOOL_ERRORS,
      expect.any(Object),
    );
    expect(meter.createCounter).toHaveBeenCalledWith(
      METRICS.MESSAGES_RECEIVED,
      expect.any(Object),
    );
    expect(meter.createHistogram).toHaveBeenCalledWith(
      METRICS.LLM_DURATION,
      expect.objectContaining({ unit: "ms" }),
    );
    expect(meter.createHistogram).toHaveBeenCalledWith(
      METRICS.TOOL_DURATION,
      expect.objectContaining({ unit: "ms" }),
    );
  });
});

describe("registerHooks", () => {
  let api: ReturnType<typeof createMockApi>;
  let tracer: ReturnType<typeof createMockTracer>;
  let meter: ReturnType<typeof createMockMeter>;

  beforeEach(() => {
    jest.clearAllMocks();
    api = createMockApi();
    tracer = createMockTracer();
    meter = createMockMeter();
    initMetrics(meter as any);
    registerHooks(api, tracer as any, config, mockLogger);
  });

  it("registers all four event handlers", () => {
    expect(api.on).toHaveBeenCalledWith("message_received", expect.any(Function));
    expect(api.on).toHaveBeenCalledWith("before_agent_start", expect.any(Function));
    expect(api.on).toHaveBeenCalledWith("tool_result_persist", expect.any(Function));
    expect(api.on).toHaveBeenCalledWith("agent_end", expect.any(Function));
  });

  it("logs that hooks are registered", () => {
    expect(mockLogger.info).toHaveBeenCalledWith(
      "[manifest] All hooks registered",
    );
  });

  describe("message_received", () => {
    it("creates a root span with SERVER kind", () => {
      api.emit("message_received", {
        sessionKey: "sess-1",
        channel: "whatsapp",
      });

      expect(tracer.startSpan).toHaveBeenCalledWith(
        SPANS.REQUEST,
        expect.objectContaining({
          kind: SpanKind.SERVER,
          attributes: expect.objectContaining({
            [ATTRS.SESSION_KEY]: "sess-1",
            [ATTRS.CHANNEL]: "whatsapp",
          }),
        }),
      );
    });

    it("increments messagesReceived counter", () => {
      api.emit("message_received", {
        sessionKey: "sess-1",
        channel: "telegram",
      });

      const counter = meter.counters.get(METRICS.MESSAGES_RECEIVED);
      expect(counter?.add).toHaveBeenCalledWith(1, {
        [ATTRS.CHANNEL]: "telegram",
      });
    });

    it("derives sessionKey from event.session.key", () => {
      api.emit("message_received", {
        session: { key: "sess-from-nested" },
        channel: "slack",
      });

      expect(tracer.startSpan).toHaveBeenCalledWith(
        SPANS.REQUEST,
        expect.objectContaining({
          attributes: expect.objectContaining({
            [ATTRS.SESSION_KEY]: "sess-from-nested",
          }),
        }),
      );
    });

    it("falls back to agent-derived sessionKey", () => {
      api.emit("message_received", { agent: "my-bot" });

      expect(tracer.startSpan).toHaveBeenCalledWith(
        SPANS.REQUEST,
        expect.objectContaining({
          attributes: expect.objectContaining({
            [ATTRS.SESSION_KEY]: "agent:my-bot:main",
          }),
        }),
      );
    });

    it("defaults channel to 'unknown'", () => {
      api.emit("message_received", { sessionKey: "sess-1" });

      expect(tracer.startSpan).toHaveBeenCalledWith(
        SPANS.REQUEST,
        expect.objectContaining({
          attributes: expect.objectContaining({
            [ATTRS.CHANNEL]: "unknown",
          }),
        }),
      );
    });
  });

  describe("before_agent_start", () => {
    it("creates a child span under root with INTERNAL kind", () => {
      api.emit("message_received", { sessionKey: "sess-1" });
      tracer.startSpan.mockClear();

      api.emit("before_agent_start", {
        sessionKey: "sess-1",
        agent: "my-agent",
      });

      expect(tracer.startSpan).toHaveBeenCalledWith(
        SPANS.AGENT_TURN,
        expect.objectContaining({
          kind: SpanKind.INTERNAL,
          attributes: expect.objectContaining({
            [ATTRS.AGENT_NAME]: "my-agent",
            [ATTRS.SESSION_KEY]: "sess-1",
          }),
        }),
        expect.anything(),
      );
    });

    it("creates standalone spans when no root exists", () => {
      api.emit("before_agent_start", {
        sessionKey: "orphan-sess",
        agent: "bot",
      });

      expect(tracer.startSpan).toHaveBeenCalledWith(
        SPANS.AGENT_TURN,
        expect.objectContaining({
          kind: SpanKind.INTERNAL,
        }),
        expect.anything(),
      );
    });

    it("defaults agent name to 'main'", () => {
      api.emit("before_agent_start", { sessionKey: "sess-1" });

      expect(tracer.startSpan).toHaveBeenCalledWith(
        SPANS.AGENT_TURN,
        expect.objectContaining({
          attributes: expect.objectContaining({
            [ATTRS.AGENT_NAME]: "main",
          }),
        }),
        expect.anything(),
      );
    });
  });

  describe("tool_result_persist", () => {
    it("creates a tool span and records metrics", () => {
      api.emit("message_received", { sessionKey: "sess-1" });
      api.emit("before_agent_start", { sessionKey: "sess-1" });
      tracer.startSpan.mockClear();

      api.emit("tool_result_persist", {
        sessionKey: "sess-1",
        toolName: "web_search",
        durationMs: 150,
      });

      expect(tracer.startSpan).toHaveBeenCalledWith(
        "tool.web_search",
        expect.objectContaining({
          kind: SpanKind.INTERNAL,
          attributes: expect.objectContaining({
            [ATTRS.TOOL_NAME]: "web_search",
            [ATTRS.TOOL_SUCCESS]: "true",
          }),
        }),
        expect.anything(),
      );

      const toolCallsCounter = meter.counters.get(METRICS.TOOL_CALLS);
      expect(toolCallsCounter?.add).toHaveBeenCalledWith(1, {
        [ATTRS.TOOL_NAME]: "web_search",
      });

      const toolDurHist = meter.histograms.get(METRICS.TOOL_DURATION);
      expect(toolDurHist?.record).toHaveBeenCalledWith(150, {
        [ATTRS.TOOL_NAME]: "web_search",
      });
    });

    it("marks span as error and increments error counter on failure", () => {
      api.emit("tool_result_persist", {
        sessionKey: "sess-1",
        toolName: "broken_tool",
        durationMs: 50,
        error: { message: "Something broke" },
      });

      const span = tracer.spans[tracer.spans.length - 1];
      expect(span.setStatus).toHaveBeenCalledWith({
        code: SpanStatusCode.ERROR,
        message: "Something broke",
      });

      const errorCounter = meter.counters.get(METRICS.TOOL_ERRORS);
      expect(errorCounter?.add).toHaveBeenCalledWith(1, {
        [ATTRS.TOOL_NAME]: "broken_tool",
      });
    });

    it("uses fallback error message when error has no message", () => {
      api.emit("tool_result_persist", {
        sessionKey: "sess-1",
        toolName: "fail_tool",
        error: {},
      });

      const span = tracer.spans[tracer.spans.length - 1];
      expect(span.setStatus).toHaveBeenCalledWith({
        code: SpanStatusCode.ERROR,
        message: "Tool execution failed",
      });
    });

    it("uses event.tool as fallback for toolName", () => {
      api.emit("tool_result_persist", {
        sessionKey: "sess-1",
        tool: "alt_tool_name",
        durationMs: 10,
      });

      expect(tracer.startSpan).toHaveBeenCalledWith(
        "tool.alt_tool_name",
        expect.any(Object),
        expect.anything(),
      );
    });

    it("ends the tool span immediately", () => {
      api.emit("tool_result_persist", {
        sessionKey: "sess-1",
        toolName: "quick_tool",
      });

      const span = tracer.spans[tracer.spans.length - 1];
      expect(span.end).toHaveBeenCalled();
    });
  });

  describe("agent_end", () => {
    it("sets attributes on turn span and ends both spans", () => {
      api.emit("message_received", { sessionKey: "sess-1" });
      api.emit("before_agent_start", { sessionKey: "sess-1" });

      const rootSpan = tracer.spans[0];
      const turnSpan = tracer.spans[1];

      api.emit("agent_end", {
        sessionKey: "sess-1",
        messages: [
          {
            role: "assistant",
            model: "claude-sonnet-4-5",
            provider: "Anthropic",
            usage: { input: 500, output: 200, cacheRead: 100 },
          },
        ],
      });

      expect(turnSpan.setAttributes).toHaveBeenCalledWith(
        expect.objectContaining({
          [ATTRS.MODEL]: "claude-sonnet-4-5",
          [ATTRS.PROVIDER]: "Anthropic",
          [ATTRS.INPUT_TOKENS]: 500,
          [ATTRS.OUTPUT_TOKENS]: 200,
          [ATTRS.CACHE_READ_TOKENS]: 100,
        }),
      );
      expect(turnSpan.end).toHaveBeenCalled();
      expect(rootSpan.end).toHaveBeenCalled();
    });

    it("records LLM metrics with model attributes", () => {
      api.emit("message_received", { sessionKey: "sess-2" });
      api.emit("before_agent_start", { sessionKey: "sess-2" });
      api.emit("agent_end", {
        sessionKey: "sess-2",
        messages: [
          {
            role: "assistant",
            model: "gpt-4o",
            provider: "OpenAI",
            usage: { input: 1000, output: 300 },
          },
        ],
      });

      const attrs = {
        [ATTRS.MODEL]: "gpt-4o",
        [ATTRS.PROVIDER]: "OpenAI",
      };
      const llmReqCounter = meter.counters.get(METRICS.LLM_REQUESTS);
      expect(llmReqCounter?.add).toHaveBeenCalledWith(1, attrs);

      const inputCounter = meter.counters.get(METRICS.LLM_TOKENS_INPUT);
      expect(inputCounter?.add).toHaveBeenCalledWith(1000, attrs);

      const outputCounter = meter.counters.get(METRICS.LLM_TOKENS_OUTPUT);
      expect(outputCounter?.add).toHaveBeenCalledWith(300, attrs);
    });

    it("records cache-read tokens only when > 0", () => {
      api.emit("message_received", { sessionKey: "sess-3" });
      api.emit("before_agent_start", { sessionKey: "sess-3" });
      api.emit("agent_end", {
        sessionKey: "sess-3",
        messages: [
          {
            role: "assistant",
            model: "test",
            usage: { input: 100, output: 50 },
          },
        ],
      });

      const cacheCounter = meter.counters.get(METRICS.LLM_TOKENS_CACHE_READ);
      expect(cacheCounter?.add).not.toHaveBeenCalled();
    });

    it("records cache-read tokens when present", () => {
      api.emit("message_received", { sessionKey: "sess-4" });
      api.emit("before_agent_start", { sessionKey: "sess-4" });
      api.emit("agent_end", {
        sessionKey: "sess-4",
        messages: [
          {
            role: "assistant",
            model: "test",
            usage: { input: 100, output: 50, cacheRead: 200 },
          },
        ],
      });

      const cacheCounter = meter.counters.get(METRICS.LLM_TOKENS_CACHE_READ);
      expect(cacheCounter?.add).toHaveBeenCalledWith(200, expect.any(Object));
    });

    it("extracts usage from the last assistant message", () => {
      api.emit("message_received", { sessionKey: "sess-5" });
      api.emit("before_agent_start", { sessionKey: "sess-5" });
      api.emit("agent_end", {
        sessionKey: "sess-5",
        messages: [
          { role: "user", content: "hello" },
          {
            role: "assistant",
            model: "old-model",
            usage: { input: 10, output: 5 },
          },
          { role: "user", content: "follow up" },
          {
            role: "assistant",
            model: "new-model",
            provider: "NewProvider",
            usage: { input: 999, output: 888 },
          },
        ],
      });

      const inputCounter = meter.counters.get(METRICS.LLM_TOKENS_INPUT);
      expect(inputCounter?.add).toHaveBeenCalledWith(999, expect.objectContaining({
        [ATTRS.MODEL]: "new-model",
      }));
    });

    it("falls back to event-level model/provider/usage when no assistant message", () => {
      api.emit("message_received", { sessionKey: "sess-6" });
      api.emit("before_agent_start", { sessionKey: "sess-6" });
      api.emit("agent_end", {
        sessionKey: "sess-6",
        model: "fallback-model",
        provider: "FallbackProvider",
        usage: { inputTokens: 42, outputTokens: 13 },
        messages: [],
      });

      const inputCounter = meter.counters.get(METRICS.LLM_TOKENS_INPUT);
      expect(inputCounter?.add).toHaveBeenCalledWith(42, expect.objectContaining({
        [ATTRS.MODEL]: "fallback-model",
      }));

      const outputCounter = meter.counters.get(METRICS.LLM_TOKENS_OUTPUT);
      expect(outputCounter?.add).toHaveBeenCalledWith(13, expect.any(Object));
    });

    it("defaults to 'unknown' model/provider when missing", () => {
      api.emit("message_received", { sessionKey: "sess-7" });
      api.emit("before_agent_start", { sessionKey: "sess-7" });
      api.emit("agent_end", {
        sessionKey: "sess-7",
        messages: [],
      });

      const llmReqCounter = meter.counters.get(METRICS.LLM_REQUESTS);
      expect(llmReqCounter?.add).toHaveBeenCalledWith(1, {
        [ATTRS.MODEL]: "unknown",
        [ATTRS.PROVIDER]: "unknown",
      });
    });

    it("does not end root span when it is the same as turn span", () => {
      // When before_agent_start fires without a prior message_received,
      // root and turn are the same span object
      api.emit("before_agent_start", { sessionKey: "orphan-sess" });
      const turnSpan = tracer.spans[0];

      api.emit("agent_end", {
        sessionKey: "orphan-sess",
        messages: [],
      });

      // end() should be called once (for turn), not twice
      expect(turnSpan.end).toHaveBeenCalledTimes(1);
    });
  });
});
