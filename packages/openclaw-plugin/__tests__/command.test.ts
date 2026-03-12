import { registerCommand } from "../src/command";
import { verifyConnection } from "../src/verify";
import { ManifestConfig } from "../src/config";

jest.mock("../src/verify", () => ({
  verifyConnection: jest.fn(),
}));
const mockVerify = verifyConnection as jest.MockedFunction<typeof verifyConnection>;
const originalFetch = global.fetch;
const mockFetch = jest.fn();

const mockLogger = {
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

const config: ManifestConfig = {
  mode: "cloud",
  devMode: true,
  apiKey: "",
  endpoint: "http://localhost:38238/otlp",
  port: 2099,
  host: "127.0.0.1",
};

describe("registerCommand", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(global, "fetch", {
      writable: true,
      value: mockFetch,
    });
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
    });
  });

  afterAll(() => {
    Object.defineProperty(global, "fetch", {
      writable: true,
      value: originalFetch,
    });
  });

  it("registers /manifest command when registerCommand is available", () => {
    const api = { registerCommand: jest.fn() };
    registerCommand(api, config, mockLogger);

    expect(api.registerCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "manifest",
        description: expect.any(String),
        execute: expect.any(Function),
      }),
    );
  });

  it("skips gracefully when registerCommand is not available", () => {
    const api = {};
    registerCommand(api, config, mockLogger);

    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining("not available"),
    );
  });

  it("returns status text on successful verify", async () => {
    mockVerify.mockResolvedValueOnce({
      endpointReachable: true,
      authValid: true,
      agentName: "test-agent",
      error: null,
    });

    const api = { registerCommand: jest.fn() };
    registerCommand(api, config, mockLogger);

    const cmd = api.registerCommand.mock.calls[0][0];
    const result = await cmd.execute();

    expect(result).toContain("Mode: cloud");
    expect(result).toContain("Endpoint reachable: yes");
    expect(result).toContain("Auth valid: yes");
    expect(result).toContain("Agent: test-agent");
    expect(result).not.toContain("Error:");
  });

  it("appends providers and routing tiers when summary is available", async () => {
    mockVerify.mockResolvedValueOnce({
      endpointReachable: true,
      authValid: true,
      agentName: "test-agent",
      error: null,
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        agentName: "test-agent",
        providers: [
          { provider: "anthropic", auth_type: "subscription" },
          { provider: "openai", auth_type: "api_key" },
        ],
        tiers: [
          { tier: "simple", model: "gpt-4.1-mini", source: "auto", fallback_models: [] },
          { tier: "standard", model: "claude-sonnet-4", source: "auto", fallback_models: [] },
          { tier: "complex", model: "claude-opus-4", source: "auto", fallback_models: [] },
          { tier: "reasoning", model: "o3", source: "override", fallback_models: [] },
        ],
      }),
    });

    const api = { registerCommand: jest.fn() };
    registerCommand(api, config, mockLogger);

    const cmd = api.registerCommand.mock.calls[0][0];
    const result = await cmd.execute();

    expect(result).toContain("Providers: anthropic (subscription), openai (api key)");
    expect(result).toContain("Routing:");
    expect(result).toContain("Simple -> gpt-4.1-mini (auto)");
    expect(result).toContain("Reasoning -> o3 (override)");
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:38238/api/v1/routing/summary",
      expect.objectContaining({
        headers: {},
      }),
    );
  });

  it("falls back to status output when the routing summary request fails", async () => {
    mockVerify.mockResolvedValueOnce({
      endpointReachable: true,
      authValid: true,
      agentName: "test-agent",
      error: null,
    });
    mockFetch.mockRejectedValueOnce(new Error("summary down"));

    const api = { registerCommand: jest.fn() };
    registerCommand(api, config, mockLogger);

    const cmd = api.registerCommand.mock.calls[0][0];
    const result = await cmd.execute();

    expect(result).toContain("Agent: test-agent");
    expect(result).not.toContain("Providers:");
    expect(result).not.toContain("Routing:");
    expect(mockLogger.debug).toHaveBeenCalledWith(
      "[manifest] Routing summary failed (summary down)",
    );
  });

  it("includes error in status text when verify reports one", async () => {
    mockVerify.mockResolvedValueOnce({
      endpointReachable: false,
      authValid: false,
      agentName: null,
      error: "Cannot reach endpoint: ECONNREFUSED",
    });

    const api = { registerCommand: jest.fn() };
    registerCommand(api, config, mockLogger);

    const cmd = api.registerCommand.mock.calls[0][0];
    const result = await cmd.execute();

    expect(result).toContain("Endpoint reachable: no");
    expect(result).toContain("Error: Cannot reach endpoint: ECONNREFUSED");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns error message when verify throws", async () => {
    mockVerify.mockRejectedValueOnce(new Error("network down"));

    const api = { registerCommand: jest.fn() };
    registerCommand(api, config, mockLogger);

    const cmd = api.registerCommand.mock.calls[0][0];
    const result = await cmd.execute();

    expect(result).toContain("Manifest status check failed: network down");
  });

  it("returns stringified error when verify throws a non-Error value", async () => {
    mockVerify.mockRejectedValueOnce("string-error");

    const api = { registerCommand: jest.fn() };
    registerCommand(api, config, mockLogger);

    const cmd = api.registerCommand.mock.calls[0][0];
    const result = await cmd.execute();

    expect(result).toContain("Manifest status check failed: string-error");
  });

  it("omits agent line when agentName is null", async () => {
    mockVerify.mockResolvedValueOnce({
      endpointReachable: true,
      authValid: true,
      agentName: null,
      error: null,
    });

    const api = { registerCommand: jest.fn() };
    registerCommand(api, config, mockLogger);

    const cmd = api.registerCommand.mock.calls[0][0];
    const result = await cmd.execute();

    expect(result).toContain("Mode: cloud");
    expect(result).toContain("Endpoint reachable: yes");
    expect(result).not.toContain("Agent:");
  });

  it("logs debug message after registering the command", () => {
    const api = { registerCommand: jest.fn() };
    registerCommand(api, config, mockLogger);

    expect(mockLogger.debug).toHaveBeenCalledWith(
      "[manifest] Registered /manifest command",
    );
  });
});
