import { registerTools } from "../src/tools";
import { ManifestConfig } from "../src/config";

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const mockLogger = {
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

const config: ManifestConfig = {
  mode: "cloud",
  apiKey: "mnfst_test_key",
  endpoint: "http://localhost:3001/otlp",
  port: 2099,
  host: "127.0.0.1",
};

interface MockTool {
  name: string;
  execute: Function;
  handler: Function;
  parameters: unknown;
  description: string;
}

function createMockApi() {
  const tools = new Map<string, MockTool>();
  return {
    tools,
    registerTool: jest.fn((tool: MockTool, _opts?: unknown) => {
      tools.set(tool.name, tool);
    }),
  };
}

describe("registerTools", () => {
  let api: ReturnType<typeof createMockApi>;

  beforeEach(() => {
    jest.clearAllMocks();
    api = createMockApi();
    registerTools(api, config, mockLogger);
  });

  it("registers three tools", () => {
    expect(api.registerTool).toHaveBeenCalledTimes(3);
    expect(api.tools.has("manifest_usage")).toBe(true);
    expect(api.tools.has("manifest_costs")).toBe(true);
    expect(api.tools.has("manifest_health")).toBe(true);
  });

  it("registers all tools with optional flag", () => {
    for (const call of api.registerTool.mock.calls) {
      expect(call[1]).toEqual({ optional: true });
    }
  });

  it("logs registered tool names", () => {
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining("manifest_usage"),
    );
  });

  describe("manifest_usage", () => {
    it("calls /api/v1/agent/usage with range=24h for 'today'", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ total_tokens: 500 }),
      });

      const tool = api.tools.get("manifest_usage")!;
      const result = await tool.execute("test-id", { period: "today" });

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3001/api/v1/agent/usage?range=24h",
        expect.objectContaining({
          headers: { Authorization: "Bearer mnfst_test_key" },
        }),
      );
      expect(result).toEqual({
        content: [{ type: "text", text: JSON.stringify({ total_tokens: 500 }) }],
      });
    });

    it("maps 'week' to range=7d", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const tool = api.tools.get("manifest_usage")!;
      await tool.execute("test-id", { period: "week" });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("range=7d"),
        expect.any(Object),
      );
    });

    it("maps 'month' to range=30d", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const tool = api.tools.get("manifest_usage")!;
      await tool.execute("test-id", { period: "month" });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("range=30d"),
        expect.any(Object),
      );
    });

    it("defaults to 24h when no period given", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const tool = api.tools.get("manifest_usage")!;
      await tool.execute("test-id", {});

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("range=24h"),
        expect.any(Object),
      );
    });

    it("returns error on non-ok response", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      const tool = api.tools.get("manifest_usage")!;
      const result = await tool.execute("test-id", { period: "today" });

      expect(result).toEqual({
        content: [{ type: "text", text: JSON.stringify({ error: "API returned 500" }) }],
      });
    });

    it("returns error on network failure", async () => {
      mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));

      const tool = api.tools.get("manifest_usage")!;
      const result = await tool.execute("test-id", { period: "today" });

      expect(result).toEqual({
        content: [{ type: "text", text: JSON.stringify({ error: "ECONNREFUSED" }) }],
      });
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("ECONNREFUSED"),
      );
    });

    it("returns stringified error on non-Error throw", async () => {
      mockFetch.mockRejectedValueOnce("raw-string-error");

      const tool = api.tools.get("manifest_usage")!;
      const result = await tool.execute("test-id", { period: "today" });

      expect(result).toEqual({
        content: [{ type: "text", text: JSON.stringify({ error: "raw-string-error" }) }],
      });
    });

    it("uses fallback range when period is unrecognized", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const tool = api.tools.get("manifest_usage")!;
      await tool.execute("test-id", { period: "quarter" });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("range=24h"),
        expect.any(Object),
      );
    });
  });

  describe("manifest_costs", () => {
    it("calls /api/v1/agent/costs with range=7d for 'week'", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ total_cost_usd: 2.45 }),
      });

      const tool = api.tools.get("manifest_costs")!;
      const result = await tool.execute("test-id", { period: "week" });

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3001/api/v1/agent/costs?range=7d",
        expect.any(Object),
      );
      expect(result).toEqual({
        content: [{ type: "text", text: JSON.stringify({ total_cost_usd: 2.45 }) }],
      });
    });

    it("defaults to 7d when no period given", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const tool = api.tools.get("manifest_costs")!;
      await tool.execute("test-id", {});

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("range=7d"),
        expect.any(Object),
      );
    });

    it("uses fallback range for unrecognized period", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const tool = api.tools.get("manifest_costs")!;
      await tool.execute("test-id", { period: "year" });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("range=7d"),
        expect.any(Object),
      );
    });
  });

  describe("manifest_health", () => {
    it("returns health status on success", async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, status: 200 })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ agentName: "test-agent" }),
        });

      const tool = api.tools.get("manifest_health")!;
      const result = await tool.execute();

      expect(result).toEqual({
        content: [{ type: "text", text: JSON.stringify({
          endpointReachable: true,
          authValid: true,
          agentName: "test-agent",
          status: "ok",
        }) }],
      });
    });

    it("returns error when connection fails", async () => {
      mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));

      const tool = api.tools.get("manifest_health")!;
      const result = await tool.execute();

      expect(result).toEqual({
        content: [{ type: "text", text: expect.stringContaining("Cannot reach endpoint") }],
      });
    });
  });

  describe("legacy handler compatibility", () => {
    it("manifest_usage handler returns legacy format on success", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ total_tokens: 500 }),
      });

      const tool = api.tools.get("manifest_usage")!;
      const result = await tool.handler({ period: "today" });

      expect(result).toEqual({ result: { total_tokens: 500 } });
    });

    it("manifest_usage handler returns legacy error format", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 503 });

      const tool = api.tools.get("manifest_usage")!;
      const result = await tool.handler({ period: "today" });

      expect(result).toEqual({ error: "API returned 503" });
    });

    it("manifest_costs handler returns legacy format on success", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ total_cost_usd: 1.23 }),
      });

      const tool = api.tools.get("manifest_costs")!;
      const result = await tool.handler({ period: "week" });

      expect(result).toEqual({ result: { total_cost_usd: 1.23 } });
    });

    it("manifest_health handler returns legacy format on success", async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, status: 200 })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ agentName: "test-agent" }),
        });

      const tool = api.tools.get("manifest_health")!;
      const result = await tool.handler();

      expect(result).toEqual({
        result: {
          endpointReachable: true,
          authValid: true,
          agentName: "test-agent",
          status: "ok",
        },
      });
    });

    it("manifest_health handler returns legacy error on failure", async () => {
      mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));

      const tool = api.tools.get("manifest_health")!;
      const result = await tool.handler();

      expect(result).toEqual({
        error: expect.stringContaining("Cannot reach endpoint"),
      });
    });
  });

  describe("endpoint stripping", () => {
    it("strips /otlp from endpoint when building API base URL", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const tool = api.tools.get("manifest_usage")!;
      await tool.execute("test-id", { period: "today" });

      const url = mockFetch.mock.calls[0][0];
      expect(url).toBe("http://localhost:3001/api/v1/agent/usage?range=24h");
      expect(url).not.toContain("/otlp");
    });
  });
});

describe("registerTools — no apiKey (dev mode)", () => {
  const devConfig: ManifestConfig = {
    mode: "dev",
    apiKey: "",
    endpoint: "http://localhost:38238/otlp",
      port: 2099,
    host: "127.0.0.1",
  };

  let devApi: ReturnType<typeof createMockApi>;

  beforeEach(() => {
    jest.clearAllMocks();
    devApi = createMockApi();
    registerTools(devApi, devConfig, mockLogger);
  });

  it("sends no Authorization header when apiKey is empty", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ total_tokens: 100 }),
    });

    const tool = devApi.tools.get("manifest_usage")!;
    await tool.execute("test-id", { period: "today" });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/agent/usage"),
      expect.objectContaining({ headers: {} }),
    );
  });
});
