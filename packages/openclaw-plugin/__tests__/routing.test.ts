import { resolveRouting, registerRouting } from "../src/routing";
import { ManifestConfig } from "../src/config";

const config: ManifestConfig = {
  mode: "local",
  apiKey: "mnfst_test-key",
  endpoint: "http://localhost:3001/otlp",
  serviceName: "test",
  captureContent: false,
  metricsIntervalMs: 30000,
  port: 2099,
  host: "127.0.0.1",
};

const mockLogger = { info: jest.fn(), debug: jest.fn(), error: jest.fn(), warn: jest.fn() };

beforeEach(() => { jest.clearAllMocks(); jest.restoreAllMocks(); });

describe("resolveRouting", () => {
  it("calls the resolve endpoint and returns tier, model, provider", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({
        tier: "standard", model: "gpt-4o", provider: "OpenAI",
        confidence: 0.8, score: 0.1, reason: "scored",
      }), { status: 200 }),
    );

    const result = await resolveRouting(
      config,
      [{ role: "user", content: "tell me about cats" }],
      "sess-1",
      mockLogger,
    );

    expect(result).toEqual({ tier: "standard", model: "gpt-4o", provider: "OpenAI" });
  });

  it("derives correct resolve URL from endpoint", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ tier: "simple", model: "gpt-4o-mini", provider: "OpenAI" }), { status: 200 }),
    );

    await resolveRouting(config, [{ role: "user", content: "hello" }], "sess-1", mockLogger);

    expect(fetchSpy).toHaveBeenCalledWith(
      "http://localhost:3001/api/v1/routing/resolve",
      expect.any(Object),
    );
    const callArgs = fetchSpy.mock.calls[0][1] as RequestInit;
    expect((callArgs.headers as Record<string, string>)["Authorization"]).toBe("Bearer mnfst_test-key");
  });

  it("strips /otlp/v1 suffix from endpoint", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ tier: "simple", model: null }), { status: 200 }),
    );

    await resolveRouting(
      { ...config, endpoint: "http://localhost:3001/otlp/v1" },
      [{ role: "user", content: "hi" }],
      "sess-1",
      mockLogger,
    );

    expect(fetchSpy).toHaveBeenCalledWith(
      "http://localhost:3001/api/v1/routing/resolve",
      expect.any(Object),
    );
  });

  it("returns null when model is null", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ tier: "simple", model: null, provider: null }), { status: 200 }),
    );

    const result = await resolveRouting(
      config,
      [{ role: "user", content: "hello" }],
      "sess-1",
      mockLogger,
    );

    expect(result).toBeNull();
  });

  it("returns null on HTTP error", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Unauthorized", { status: 401 }),
    );

    const result = await resolveRouting(
      config,
      [{ role: "user", content: "hello" }],
      "sess-1",
      mockLogger,
    );

    expect(result).toBeNull();
  });

  it("returns null on network error", async () => {
    jest.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNREFUSED"));

    const result = await resolveRouting(
      config,
      [{ role: "user", content: "hello" }],
      "sess-1",
      mockLogger,
    );

    expect(result).toBeNull();
  });

  it("returns null when messages are empty", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch");

    const result = await resolveRouting(config, [], "sess-1", mockLogger);

    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("strips extra fields from messages (only sends role + content)", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ tier: "standard", model: "gpt-4o", provider: "OpenAI" }), { status: 200 }),
    );

    await resolveRouting(config, [
      { role: "user", content: "hello", usage: { input: 10 }, model: "auto", tool_calls: [] },
    ], "sess-strip", mockLogger);

    const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
    expect(body.messages).toEqual([{ role: "user", content: "hello" }]);
  });

  it("excludes system and developer messages from scoring", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ tier: "simple", model: "gpt-4o-mini", provider: "OpenAI" }), { status: 200 }),
    );

    await resolveRouting(config, [
      { role: "system", content: "You are a helpful assistant" },
      { role: "developer", content: "Internal prompt" },
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello!" },
    ], "sess-filter", mockLogger);

    const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
    expect(body.messages).toEqual([
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello!" },
    ]);
  });

  it("returns null when only system/developer messages remain after filtering", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch");

    const result = await resolveRouting(config, [
      { role: "system", content: "system prompt" },
    ], "sess-sysonly", mockLogger);

    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("tracks momentum across calls", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch");
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ tier: "complex", model: "claude-sonnet-4", provider: "Anthropic" }), { status: 200 }),
    );
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ tier: "complex", model: "claude-sonnet-4", provider: "Anthropic" }), { status: 200 }),
    );

    await resolveRouting(config, [{ role: "user", content: "first" }], "sess-momentum", mockLogger);
    await resolveRouting(config, [{ role: "user", content: "second" }], "sess-momentum", mockLogger);

    const secondBody = JSON.parse(fetchSpy.mock.calls[1][1]!.body as string);
    expect(secondBody.recentTiers).toEqual(["complex"]);
  });
});

describe("registerRouting — provider mode", () => {
  function createMockApi(hasRegisterProvider = false) {
    let registeredProvider: Record<string, unknown> | null = null;
    return {
      registeredProvider: () => registeredProvider,
      ...(hasRegisterProvider
        ? { registerProvider: jest.fn((cfg: Record<string, unknown>) => { registeredProvider = cfg; }) }
        : {}),
    };
  }

  it("registers as an OpenAI-compatible provider when registerProvider is available", () => {
    const api = createMockApi(true);
    registerRouting(api, config, mockLogger);
    expect((api as any).registerProvider).toHaveBeenCalledWith({
      id: "manifest", name: "Manifest Router", api: "openai-completions",
      baseUrl: "http://localhost:3001", apiKey: "mnfst_test-key", models: ["auto"],
    });
  });

  it("logs proxy mode on success", () => {
    const api = createMockApi(true);
    registerRouting(api, config, mockLogger);
    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("proxy mode"));
  });

  it("strips /otlp/v1 suffix from endpoint for baseUrl", () => {
    const api = createMockApi(true);
    registerRouting(api, { ...config, endpoint: "http://localhost:3001/otlp/v1" }, mockLogger);
    expect((api as any).registerProvider).toHaveBeenCalledWith(
      expect.objectContaining({ baseUrl: "http://localhost:3001" }),
    );
  });

  it("does nothing when registerProvider is not available", () => {
    const api = createMockApi(false);
    registerRouting(api, config, mockLogger);
    expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining("not available"));
  });

  it("handles registerProvider throwing", () => {
    const api = createMockApi(false);
    (api as any).registerProvider = jest.fn(() => { throw new Error("Not implemented"); });
    registerRouting(api, config, mockLogger);
    expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining("failed"));
  });
});
