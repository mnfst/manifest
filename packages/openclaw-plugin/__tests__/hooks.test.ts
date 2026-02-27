import { SpanKind, SpanStatusCode } from "@opentelemetry/api";
import { initMetrics, registerHooks } from "../src/hooks";
import { SPANS, METRICS, ATTRS } from "../src/constants";
import { ManifestConfig } from "../src/config";
import { resolveRouting } from "../src/routing";

jest.mock("../src/routing", () => ({
  resolveRouting: jest.fn(),
}));
const mockResolveRouting = resolveRouting as jest.MockedFunction<typeof resolveRouting>;

// --- Mock span ---
function createMockSpan() {
  return {
    setAttribute: jest.fn(),
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
  mode: "cloud",
  apiKey: "mnfst_test",
  endpoint: "http://localhost:3001/otlp",
  port: 2099,
  host: "127.0.0.1",
};

const localConfig: ManifestConfig = {
  mode: "local",
  apiKey: "",
  endpoint: "http://localhost:38238/otlp",
  port: 2099,
  host: "127.0.0.1",
};

const devConfig: ManifestConfig = {
  mode: "dev",
  apiKey: "",
  endpoint: "http://localhost:38238/otlp",
  port: 2099,
  host: "127.0.0.1",
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

  it("falls back to registerHook when api.on is not available", () => {
    const fallbackApi = {
      handlers: new Map<string, (event: unknown) => void>(),
      registerHook: jest.fn((event: string, handler: (event: unknown) => void) => {
        fallbackApi.handlers.set(event, handler);
      }),
    };
    const fbTracer = createMockTracer();
    const fbMeter = createMockMeter();
    initMetrics(fbMeter as any);
    registerHooks(fallbackApi as any, fbTracer as any, config, mockLogger);

    expect(fallbackApi.registerHook).toHaveBeenCalledWith("message_received", expect.any(Function));
    expect(fallbackApi.registerHook).toHaveBeenCalledWith("agent_end", expect.any(Function));
  });

  it("logs that hooks are registered", () => {
    expect(mockLogger.debug).toHaveBeenCalledWith(
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

    it("sets ERROR status on turn span when event.success is false", () => {
      api.emit("message_received", { sessionKey: "sess-err" });
      api.emit("before_agent_start", { sessionKey: "sess-err" });

      const turnSpan = tracer.spans[1];

      api.emit("agent_end", {
        sessionKey: "sess-err",
        success: false,
        error: { message: "403 Key limit exceeded" },
        messages: [],
      });

      expect(turnSpan.setStatus).toHaveBeenCalledWith({
        code: SpanStatusCode.ERROR,
        message: "403 Key limit exceeded",
      });
      expect(turnSpan.end).toHaveBeenCalled();
    });

    it("uses fallback error message when event.error is absent", () => {
      api.emit("message_received", { sessionKey: "sess-err2" });
      api.emit("before_agent_start", { sessionKey: "sess-err2" });

      const turnSpan = tracer.spans[1];

      api.emit("agent_end", {
        sessionKey: "sess-err2",
        success: false,
        messages: [],
      });

      expect(turnSpan.setStatus).toHaveBeenCalledWith({
        code: SpanStatusCode.ERROR,
        message: "Agent turn failed",
      });
    });

    it("does not set ERROR status when event.success is true", () => {
      api.emit("message_received", { sessionKey: "sess-ok" });
      api.emit("before_agent_start", { sessionKey: "sess-ok" });

      const turnSpan = tracer.spans[1];

      api.emit("agent_end", {
        sessionKey: "sess-ok",
        success: true,
        messages: [
          { role: "assistant", model: "gpt-4o", usage: { input: 10, output: 5 } },
        ],
      });

      expect(turnSpan.setStatus).not.toHaveBeenCalled();
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

    it("sets ROUTING_REASON and ROUTING_TIER for heartbeat when messages contain HEARTBEAT_OK", () => {
      api.emit("message_received", { sessionKey: "hb-sess" });
      api.emit("before_agent_start", { sessionKey: "hb-sess" });

      const turnSpan = tracer.spans[1];

      api.emit("agent_end", {
        sessionKey: "hb-sess",
        messages: [
          { role: "user", content: "Check tasks and reply HEARTBEAT_OK if nothing needs attention." },
          {
            role: "assistant",
            model: "gpt-4o-mini",
            provider: "OpenAI",
            usage: { input: 50, output: 10 },
          },
        ],
      });

      expect(turnSpan.setAttribute).toHaveBeenCalledWith(
        ATTRS.ROUTING_REASON,
        "heartbeat",
      );
      expect(turnSpan.setAttribute).toHaveBeenCalledWith(
        ATTRS.ROUTING_TIER,
        "simple",
      );
    });

    it("sets ROUTING_REASON and ROUTING_TIER for heartbeat when HEARTBEAT_OK is in array content", () => {
      api.emit("message_received", { sessionKey: "hb-arr-sess" });
      api.emit("before_agent_start", { sessionKey: "hb-arr-sess" });

      const turnSpan = tracer.spans[1];

      api.emit("agent_end", {
        sessionKey: "hb-arr-sess",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Check tasks and reply HEARTBEAT_OK if nothing needs attention." },
            ],
          },
          {
            role: "assistant",
            model: "gpt-4o-mini",
            provider: "OpenAI",
            usage: { input: 50, output: 10 },
          },
        ],
      });

      expect(turnSpan.setAttribute).toHaveBeenCalledWith(
        ATTRS.ROUTING_REASON,
        "heartbeat",
      );
      expect(turnSpan.setAttribute).toHaveBeenCalledWith(
        ATTRS.ROUTING_TIER,
        "simple",
      );
    });

    it("does not detect heartbeat when user message content is neither string nor array", () => {
      api.emit("message_received", { sessionKey: "hb-nonstr-sess" });
      api.emit("before_agent_start", { sessionKey: "hb-nonstr-sess" });

      const turnSpan = tracer.spans[1];

      api.emit("agent_end", {
        sessionKey: "hb-nonstr-sess",
        messages: [
          { role: "user", content: 12345 },
          {
            role: "assistant",
            model: "gpt-4o",
            provider: "OpenAI",
            usage: { input: 50, output: 10 },
          },
        ],
      });

      expect(turnSpan.setAttribute).not.toHaveBeenCalledWith(
        ATTRS.ROUTING_REASON,
        expect.anything(),
      );
    });

    it("does not detect heartbeat for null message objects", () => {
      api.emit("message_received", { sessionKey: "hb-null-sess" });
      api.emit("before_agent_start", { sessionKey: "hb-null-sess" });

      const turnSpan = tracer.spans[1];

      api.emit("agent_end", {
        sessionKey: "hb-null-sess",
        messages: [
          null,
          { role: "assistant", model: "gpt-4o", usage: { input: 10, output: 5 } },
        ],
      });

      expect(turnSpan.setAttribute).not.toHaveBeenCalledWith(
        ATTRS.ROUTING_REASON,
        expect.anything(),
      );
    });

    it("does not detect heartbeat when array content part has non-text type", () => {
      api.emit("message_received", { sessionKey: "hb-imgcontent" });
      api.emit("before_agent_start", { sessionKey: "hb-imgcontent" });

      const turnSpan = tracer.spans[1];

      api.emit("agent_end", {
        sessionKey: "hb-imgcontent",
        messages: [
          {
            role: "user",
            content: [
              { type: "image", url: "HEARTBEAT_OK.png" },
            ],
          },
          {
            role: "assistant",
            model: "gpt-4o",
            provider: "OpenAI",
            usage: { input: 50, output: 10 },
          },
        ],
      });

      expect(turnSpan.setAttribute).not.toHaveBeenCalledWith(
        ATTRS.ROUTING_REASON,
        "heartbeat",
      );
    });

    it("does not set ROUTING_REASON when no heartbeat sentinel", () => {
      api.emit("message_received", { sessionKey: "no-hb-sess" });
      api.emit("before_agent_start", { sessionKey: "no-hb-sess" });

      const turnSpan = tracer.spans[1];

      api.emit("agent_end", {
        sessionKey: "no-hb-sess",
        messages: [
          { role: "user", content: "Hello, how are you?" },
          {
            role: "assistant",
            model: "gpt-4o",
            provider: "OpenAI",
            usage: { input: 100, output: 50 },
          },
        ],
      });

      expect(turnSpan.setAttribute).not.toHaveBeenCalledWith(
        ATTRS.ROUTING_REASON,
        expect.anything(),
      );
    });

    it("uses event.errorMessage as fallback when event.error is absent", () => {
      api.emit("message_received", { sessionKey: "sess-errmsg" });
      api.emit("before_agent_start", { sessionKey: "sess-errmsg" });

      const turnSpan = tracer.spans[1];

      api.emit("agent_end", {
        sessionKey: "sess-errmsg",
        success: false,
        errorMessage: "Provider returned 503",
        messages: [],
      });

      expect(turnSpan.setStatus).toHaveBeenCalledWith({
        code: SpanStatusCode.ERROR,
        message: "Provider returned 503",
      });
    });

    it("truncates long error messages to 500 characters", () => {
      api.emit("message_received", { sessionKey: "sess-longmsg" });
      api.emit("before_agent_start", { sessionKey: "sess-longmsg" });

      const turnSpan = tracer.spans[1];
      const longMsg = "x".repeat(600);

      api.emit("agent_end", {
        sessionKey: "sess-longmsg",
        success: false,
        error: { message: longMsg },
        messages: [],
      });

      expect(turnSpan.setStatus).toHaveBeenCalledWith({
        code: SpanStatusCode.ERROR,
        message: "x".repeat(500),
      });
    });
  });

  describe("agent_end with routing resolution", () => {
    let localApi: ReturnType<typeof createMockApi>;
    let localTracer: ReturnType<typeof createMockTracer>;
    let localMeter: ReturnType<typeof createMockMeter>;

    beforeEach(() => {
      jest.clearAllMocks();
      localApi = createMockApi();
      localTracer = createMockTracer();
      localMeter = createMockMeter();
      initMetrics(localMeter as any);
      registerHooks(localApi, localTracer as any, localConfig, mockLogger);
    });

    it("sets ROUTING_REASON from resolved routing when model is auto in local mode", async () => {
      mockResolveRouting.mockResolvedValueOnce({
        tier: "standard",
        model: "gpt-4o",
        provider: "OpenAI",
        reason: "scored",
      });

      localApi.emit("message_received", { sessionKey: "route-sess" });
      localApi.emit("before_agent_start", { sessionKey: "route-sess" });

      const turnSpan = localTracer.spans[1];

      localApi.emit("agent_end", {
        sessionKey: "route-sess",
        messages: [
          {
            role: "assistant",
            model: "auto",
            provider: "manifest",
            usage: { input: 100, output: 50 },
          },
        ],
      });

      // Wait for async agent_end handler
      await new Promise((r) => setTimeout(r, 50));

      expect(mockResolveRouting).toHaveBeenCalled();
      expect(turnSpan.setAttribute).toHaveBeenCalledWith(
        ATTRS.ROUTING_TIER,
        "standard",
      );
      expect(turnSpan.setAttribute).toHaveBeenCalledWith(
        ATTRS.ROUTING_REASON,
        "scored",
      );
    });

    it("resolves routing in dev mode when model is auto", async () => {
      jest.clearAllMocks();
      const devApi = createMockApi();
      const devTracer = createMockTracer();
      const devMeter = createMockMeter();
      initMetrics(devMeter as any);
      registerHooks(devApi, devTracer as any, devConfig, mockLogger);

      mockResolveRouting.mockResolvedValueOnce({
        tier: "complex",
        model: "claude-sonnet-4",
        provider: "Anthropic",
        reason: "multi-step",
      });

      devApi.emit("message_received", { sessionKey: "dev-sess" });
      devApi.emit("before_agent_start", { sessionKey: "dev-sess" });

      const turnSpan = devTracer.spans[1];

      devApi.emit("agent_end", {
        sessionKey: "dev-sess",
        messages: [
          {
            role: "assistant",
            model: "auto",
            provider: "manifest",
            usage: { input: 200, output: 100 },
          },
        ],
      });

      await new Promise((r) => setTimeout(r, 50));

      expect(mockResolveRouting).toHaveBeenCalled();
      expect(turnSpan.setAttribute).toHaveBeenCalledWith(
        ATTRS.ROUTING_REASON,
        "multi-step",
      );
    });

    it("resolves routing in cloud mode when model is auto", async () => {
      jest.clearAllMocks();
      const cloudApi = createMockApi();
      const cloudTracer = createMockTracer();
      const cloudMeter = createMockMeter();
      initMetrics(cloudMeter as any);
      registerHooks(cloudApi, cloudTracer as any, config, mockLogger);

      mockResolveRouting.mockResolvedValueOnce({
        tier: "standard",
        model: "gpt-4o",
        provider: "OpenAI",
        reason: "scored",
      });

      cloudApi.emit("message_received", { sessionKey: "cloud-sess" });
      cloudApi.emit("before_agent_start", { sessionKey: "cloud-sess" });

      const turnSpan = cloudTracer.spans[1];

      cloudApi.emit("agent_end", {
        sessionKey: "cloud-sess",
        messages: [
          {
            role: "assistant",
            model: "auto",
            provider: "manifest",
            usage: { input: 50, output: 25 },
          },
        ],
      });

      await new Promise((r) => setTimeout(r, 50));

      expect(mockResolveRouting).toHaveBeenCalled();
      expect(turnSpan.setAttributes).toHaveBeenCalledWith(
        expect.objectContaining({
          [ATTRS.MODEL]: "gpt-4o",
          [ATTRS.PROVIDER]: "OpenAI",
        }),
      );
      expect(turnSpan.setAttribute).toHaveBeenCalledWith(
        ATTRS.ROUTING_TIER,
        "standard",
      );
      expect(turnSpan.setAttribute).toHaveBeenCalledWith(
        ATTRS.ROUTING_REASON,
        "scored",
      );
    });

    it("overrides routing reason to heartbeat when HEARTBEAT_OK is in messages and model is auto", async () => {
      mockResolveRouting.mockResolvedValueOnce({
        tier: "standard",
        model: "gpt-4o-mini",
        provider: "OpenAI",
        reason: "scored",
      });

      localApi.emit("message_received", { sessionKey: "hb-route" });
      localApi.emit("before_agent_start", { sessionKey: "hb-route" });

      const turnSpan = localTracer.spans[1];

      localApi.emit("agent_end", {
        sessionKey: "hb-route",
        messages: [
          { role: "user", content: "HEARTBEAT_OK check" },
          {
            role: "assistant",
            model: "auto",
            provider: "manifest",
            usage: { input: 20, output: 5 },
          },
        ],
      });

      await new Promise((r) => setTimeout(r, 50));

      // Heartbeat overrides the routing reason
      expect(turnSpan.setAttribute).toHaveBeenCalledWith(
        ATTRS.ROUTING_REASON,
        "heartbeat",
      );
      expect(turnSpan.setAttribute).toHaveBeenCalledWith(
        ATTRS.ROUTING_TIER,
        "simple",
      );
    });
  });
});
