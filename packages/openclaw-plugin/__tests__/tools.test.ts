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
  apiKey: "mnfst_test_key",
  endpoint: "http://localhost:3001/otlp",
  serviceName: "test",
  captureContent: false,
  metricsIntervalMs: 30000,
};

function createMockApi() {
  const tools = new Map<string, { name: string; handler: Function; parameters: unknown; description: string }>();
  return {
    tools,
    registerTool: jest.fn((tool: { name: string; handler: Function; parameters: unknown; description: string }) => {
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

  it("logs registered tool names", () => {
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining("manifest_usage"),
    );
  });

  describe("manifest_usage", () => {
    it("calls /api/v1/agent/usage with range=24h for 'today'", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ total_tokens: 500 }),
      });

      const handler = api.tools.get("manifest_usage")!.handler;
      const result = await handler({ period: "today" });

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3001/api/v1/agent/usage?range=24h",
        expect.objectContaining({
          headers: { Authorization: "Bearer mnfst_test_key" },
        }),
      );
      expect(result).toEqual({ result: { total_tokens: 500 } });
    });

    it("maps 'week' to range=7d", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const handler = api.tools.get("manifest_usage")!.handler;
      await handler({ period: "week" });

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

      const handler = api.tools.get("manifest_usage")!.handler;
      await handler({ period: "month" });

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

      const handler = api.tools.get("manifest_usage")!.handler;
      await handler({});

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("range=24h"),
        expect.any(Object),
      );
    });

    it("returns error on non-ok response", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      const handler = api.tools.get("manifest_usage")!.handler;
      const result = await handler({ period: "today" });

      expect(result).toEqual({ error: "API returned 500" });
    });

    it("returns error on network failure", async () => {
      mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));

      const handler = api.tools.get("manifest_usage")!.handler;
      const result = await handler({ period: "today" });

      expect(result).toEqual({ error: "ECONNREFUSED" });
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("ECONNREFUSED"),
      );
    });
  });

  describe("manifest_costs", () => {
    it("calls /api/v1/agent/costs with range=7d for 'week'", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ total_cost_usd: 2.45 }),
      });

      const handler = api.tools.get("manifest_costs")!.handler;
      const result = await handler({ period: "week" });

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3001/api/v1/agent/costs?range=7d",
        expect.any(Object),
      );
      expect(result).toEqual({ result: { total_cost_usd: 2.45 } });
    });

    it("defaults to 7d when no period given", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const handler = api.tools.get("manifest_costs")!.handler;
      await handler({});

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

      const handler = api.tools.get("manifest_health")!.handler;
      const result = await handler();

      expect(result).toEqual({
        result: {
          endpointReachable: true,
          authValid: true,
          agentName: "test-agent",
          status: "ok",
        },
      });
    });

    it("returns error when connection fails", async () => {
      mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));

      const handler = api.tools.get("manifest_health")!.handler;
      const result = await handler();

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

      const handler = api.tools.get("manifest_usage")!.handler;
      await handler({ period: "today" });

      const url = mockFetch.mock.calls[0][0];
      expect(url).toBe("http://localhost:3001/api/v1/agent/usage?range=24h");
      expect(url).not.toContain("/otlp");
    });
  });
});
