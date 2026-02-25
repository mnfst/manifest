import { verifyConnection, VerifyResult } from "../src/verify";
import { ManifestConfig } from "../src/config";

const baseConfig: ManifestConfig = {
  mode: "cloud",
  apiKey: "mnfst_test123",
  endpoint: "http://localhost:3001/otlp",
  port: 2099,
  host: "127.0.0.1",
};

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe("verifyConnection", () => {
  it("returns success when health + usage both respond ok", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ agentName: "my-agent" }),
      });

    const result = await verifyConnection(baseConfig);

    expect(result.endpointReachable).toBe(true);
    expect(result.authValid).toBe(true);
    expect(result.agentName).toBe("my-agent");
    expect(result.error).toBeNull();
  });

  it("strips /otlp from endpoint for API calls", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({}),
      });

    await verifyConnection(baseConfig);

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3001/api/v1/health",
      expect.any(Object),
    );
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3001/api/v1/agent/usage?range=24h",
      expect.objectContaining({
        headers: { Authorization: "Bearer mnfst_test123" },
      }),
    );
  });

  it("strips /otlp/v1 from endpoint for API calls", async () => {
    const configWithV1 = { ...baseConfig, endpoint: "http://localhost:3001/otlp/v1" };
    mockFetch
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({}),
      });

    await verifyConnection(configWithV1);

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3001/api/v1/health",
      expect.any(Object),
    );
  });

  it("strips /otlp/ (with trailing slash) from endpoint", async () => {
    const configTrailing = { ...baseConfig, endpoint: "http://localhost:3001/otlp/" };
    mockFetch
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({}),
      });

    await verifyConnection(configTrailing);

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3001/api/v1/health",
      expect.any(Object),
    );
  });

  it("reports unreachable when health check fails", async () => {
    mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const result = await verifyConnection(baseConfig);

    expect(result.endpointReachable).toBe(false);
    expect(result.authValid).toBe(false);
    expect(result.error).toContain("Cannot reach endpoint");
    expect(result.error).toContain("ECONNREFUSED");
  });

  it("reports unreachable when health returns non-ok status", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 503 });

    const result = await verifyConnection(baseConfig);

    expect(result.endpointReachable).toBe(false);
    expect(result.error).toContain("503");
  });

  it("reports auth failure on 401", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockResolvedValueOnce({ ok: false, status: 401 });

    const result = await verifyConnection(baseConfig);

    expect(result.endpointReachable).toBe(true);
    expect(result.authValid).toBe(false);
    expect(result.error).toContain("API key rejected");
  });

  it("reports auth failure on 403", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockResolvedValueOnce({ ok: false, status: 403 });

    const result = await verifyConnection(baseConfig);

    expect(result.endpointReachable).toBe(true);
    expect(result.authValid).toBe(false);
    expect(result.error).toContain("API key rejected");
  });

  it("handles usage endpoint network error", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockRejectedValueOnce(new Error("timeout"));

    const result = await verifyConnection(baseConfig);

    expect(result.endpointReachable).toBe(true);
    expect(result.authValid).toBe(false);
    expect(result.error).toContain("Auth check failed");
  });

  it("handles missing agentName in response", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ totalTokens: 100 }),
      });

    const result = await verifyConnection(baseConfig);

    expect(result.authValid).toBe(true);
    expect(result.agentName).toBeNull();
    expect(result.error).toBeNull();
  });

  it("handles non-ok status from usage endpoint", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockResolvedValueOnce({ ok: false, status: 500 });

    const result = await verifyConnection(baseConfig);

    expect(result.endpointReachable).toBe(true);
    expect(result.authValid).toBe(false);
    expect(result.error).toContain("500");
  });

  it("sends no Authorization header when apiKey is empty (dev mode)", async () => {
    const devConfig = { ...baseConfig, mode: "dev" as const, apiKey: "" };
    mockFetch
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ agentName: "dev-agent" }),
      });

    const result = await verifyConnection(devConfig);

    expect(result.authValid).toBe(true);
    expect(result.agentName).toBe("dev-agent");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/agent/usage"),
      expect.objectContaining({ headers: {} }),
    );
  });
});
