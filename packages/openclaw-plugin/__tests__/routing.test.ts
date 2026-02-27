import { resolveRouting, registerRouting } from "../src/routing";
import { ManifestConfig } from "../src/config";

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const mockLogger = {
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

const cloudConfig: ManifestConfig = {
  mode: "cloud",
  apiKey: "mnfst_test_key",
  endpoint: "http://localhost:3001/otlp",
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

beforeEach(() => {
  jest.clearAllMocks();
});

describe("resolveRouting", () => {
  const messages = [{ role: "user", content: "hello" }];

  it("returns null for empty messages", async () => {
    const result = await resolveRouting(cloudConfig, [], "sess-1", mockLogger);
    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns null for null messages", async () => {
    const result = await resolveRouting(cloudConfig, null as any, "sess-1", mockLogger);
    expect(result).toBeNull();
  });

  it("returns null when all messages are system/developer roles", async () => {
    const sysMessages = [
      { role: "system", content: "You are helpful" },
      { role: "developer", content: "Rules" },
    ];
    const result = await resolveRouting(cloudConfig, sysMessages, "sess-1", mockLogger);
    expect(result).toBeNull();
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining("no scorable messages"),
    );
  });

  it("sends Authorization header when apiKey is present", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tier: "simple", model: "gpt-4o-mini", provider: "OpenAI", confidence: 0.9, score: 2, reason: "test" }),
    });

    await resolveRouting(cloudConfig, messages, "sess-1", mockLogger);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer mnfst_test_key",
        },
      }),
    );
  });

  it("sends no Authorization header when apiKey is empty (dev mode)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tier: "simple", model: "gpt-4o-mini", provider: "OpenAI", confidence: 0.9, score: 2, reason: "test" }),
    });

    await resolveRouting(devConfig, messages, "sess-dev-1", mockLogger);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: { "Content-Type": "application/json" },
      }),
    );
  });

  it("returns resolved model and tier on success", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tier: "complex",
        model: "gpt-4o",
        provider: "OpenAI",
        confidence: 0.95,
        score: 8,
        reason: "multi-step reasoning",
      }),
    });

    const result = await resolveRouting(cloudConfig, messages, "sess-2", mockLogger);

    expect(result).toEqual({
      tier: "complex",
      model: "gpt-4o",
      provider: "OpenAI",
      reason: "multi-step reasoning",
    });
  });

  it("returns null when model is null in response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tier: "unknown", model: null, provider: null }),
    });

    const result = await resolveRouting(cloudConfig, messages, "sess-3", mockLogger);
    expect(result).toBeNull();
  });

  it("returns null on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    const result = await resolveRouting(cloudConfig, messages, "sess-4", mockLogger);
    expect(result).toBeNull();
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining("returned 500"),
    );
  });

  it("returns null on fetch error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const result = await resolveRouting(cloudConfig, messages, "sess-5", mockLogger);
    expect(result).toBeNull();
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining("ECONNREFUSED"),
    );
  });

  it("defaults provider to 'unknown' when null", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tier: "simple", model: "gpt-4o-mini", provider: null }),
    });

    const result = await resolveRouting(cloudConfig, messages, "sess-6", mockLogger);
    expect(result?.provider).toBe("unknown");
  });

  it("defaults reason to empty string when not in response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tier: "simple", model: "gpt-4o-mini", provider: "OpenAI" }),
    });

    const result = await resolveRouting(cloudConfig, messages, "sess-reason-1", mockLogger);
    expect(result?.reason).toBe("");
  });

  it("passes through reason from response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tier: "complex", model: "claude-opus-4", provider: "Anthropic", reason: "multi-step reasoning" }),
    });

    const result = await resolveRouting(cloudConfig, messages, "sess-reason-2", mockLogger);
    expect(result?.reason).toBe("multi-step reasoning");
  });

  it("strips /otlp from endpoint when building resolve URL", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tier: "simple", model: "gpt-4o-mini", provider: "OpenAI" }),
    });

    await resolveRouting(cloudConfig, messages, "sess-7", mockLogger);

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3001/api/v1/routing/resolve",
      expect.any(Object),
    );
  });

  it("filters out system and developer messages", async () => {
    const mixedMessages = [
      { role: "system", content: "system prompt" },
      { role: "developer", content: "dev instructions" },
      { role: "user", content: "hello" },
      { role: "assistant", content: "hi there" },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tier: "simple", model: "gpt-4o-mini", provider: "OpenAI" }),
    });

    await resolveRouting(cloudConfig, mixedMessages, "sess-8", mockLogger);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.messages).toEqual([
      { role: "user", content: "hello" },
      { role: "assistant", content: "hi there" },
    ]);
  });

  it("updates momentum on successful resolve", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tier: "simple", model: "gpt-4o-mini", provider: "OpenAI" }),
    });

    await resolveRouting(cloudConfig, messages, "momentum-sess", mockLogger);

    // Second call should include recentTiers
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tier: "complex", model: "gpt-4o", provider: "OpenAI" }),
    });

    await resolveRouting(cloudConfig, messages, "momentum-sess", mockLogger);

    const body = JSON.parse(mockFetch.mock.calls[1][1].body);
    expect(body.recentTiers).toContain("simple");
  });
});

describe("registerRouting", () => {
  it("registers provider when registerProvider is available", () => {
    const api = { registerProvider: jest.fn() };
    registerRouting(api, cloudConfig, mockLogger);

    expect(api.registerProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "manifest",
        models: ["auto"],
      }),
    );
  });

  it("skips when registerProvider is not a function", () => {
    const api = {};
    registerRouting(api, cloudConfig, mockLogger);

    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining("not available"),
    );
  });

  it("handles registerProvider error gracefully", () => {
    const api = { registerProvider: jest.fn(() => { throw new Error("fail"); }) };
    registerRouting(api, cloudConfig, mockLogger);

    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining("registerProvider failed"),
    );
  });
});
