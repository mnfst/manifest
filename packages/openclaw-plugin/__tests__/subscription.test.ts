import { existsSync, readFileSync, readdirSync } from "fs";
import {
  discoverSubscriptionProviders,
  registerSubscriptionProviders,
  SubscriptionProvider,
} from "../src/subscription";

jest.mock("fs");
jest.mock("os", () => ({ homedir: () => "/mock-home" }));

const mockExistsSync = existsSync as jest.MockedFunction<typeof existsSync>;
const mockReadFileSync = readFileSync as jest.MockedFunction<typeof readFileSync>;
const mockReaddirSync = readdirSync as jest.MockedFunction<typeof readdirSync>;

const mockLogger = {
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("discoverSubscriptionProviders", () => {
  it("returns empty array when agents directory does not exist", () => {
    mockExistsSync.mockReturnValue(false);

    const result = discoverSubscriptionProviders(mockLogger);

    expect(result).toEqual([]);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      "[manifest] No agents directory, no subscription providers",
    );
  });

  it("discovers OAuth providers from auth-profiles.json", () => {
    mockExistsSync.mockImplementation((p) => {
      const path = String(p);
      if (path.endsWith("agents")) return true;
      if (path.endsWith("auth-profiles.json")) return true;
      return false;
    });
    mockReaddirSync.mockReturnValue([
      { name: "agent-1", isDirectory: () => true } as any,
    ]);
    mockReadFileSync.mockReturnValue(
      JSON.stringify({
        profiles: {
          "anthropic-oauth": { type: "oauth", provider: "anthropic" },
          "openai-codex-setup": { type: "setup_token", provider: "openai-codex" },
        },
      }),
    );

    const result = discoverSubscriptionProviders(mockLogger);

    expect(result).toHaveLength(2);
    expect(result).toEqual(
      expect.arrayContaining([
        { openclawId: "anthropic", manifestId: "anthropic", authType: "oauth" },
        { openclawId: "openai-codex", manifestId: "openai", authType: "setup_token" },
      ]),
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining("Detected 2 subscription provider(s)"),
    );
  });

  it("skips api_key type entries", () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue([
      { name: "agent-1", isDirectory: () => true } as any,
    ]);
    mockReadFileSync.mockReturnValue(
      JSON.stringify({
        profiles: {
          "my-api-key": { type: "api_key", provider: "anthropic" },
        },
      }),
    );

    const result = discoverSubscriptionProviders(mockLogger);
    expect(result).toEqual([]);
  });

  it("skips manifest provider entries", () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue([
      { name: "agent-1", isDirectory: () => true } as any,
    ]);
    mockReadFileSync.mockReturnValue(
      JSON.stringify({
        profiles: {
          "manifest-entry": { type: "oauth", provider: "manifest" },
        },
      }),
    );

    const result = discoverSubscriptionProviders(mockLogger);
    expect(result).toEqual([]);
  });

  it("logs debug for unknown provider mappings", () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue([
      { name: "agent-1", isDirectory: () => true } as any,
    ]);
    mockReadFileSync.mockReturnValue(
      JSON.stringify({
        profiles: {
          "unknown-entry": { type: "oauth", provider: "some-unknown-provider" },
        },
      }),
    );

    const result = discoverSubscriptionProviders(mockLogger);
    expect(result).toEqual([]);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      "[manifest] Unknown subscription provider: some-unknown-provider",
    );
  });

  it("deduplicates providers across multiple agents", () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue([
      { name: "agent-1", isDirectory: () => true } as any,
      { name: "agent-2", isDirectory: () => true } as any,
    ]);
    mockReadFileSync.mockReturnValue(
      JSON.stringify({
        profiles: {
          "anthropic-oauth": { type: "oauth", provider: "anthropic" },
        },
      }),
    );

    const result = discoverSubscriptionProviders(mockLogger);
    expect(result).toHaveLength(1);
  });

  it("skips profiles with missing or non-object profiles field", () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue([
      { name: "agent-1", isDirectory: () => true } as any,
    ]);
    mockReadFileSync.mockReturnValue(JSON.stringify({ other: "data" }));

    const result = discoverSubscriptionProviders(mockLogger);
    expect(result).toEqual([]);
  });

  it("handles readdir errors gracefully", () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockImplementation(() => {
      throw new Error("permission denied");
    });

    const result = discoverSubscriptionProviders(mockLogger);
    expect(result).toEqual([]);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      "[manifest] Error scanning auth profiles: permission denied",
    );
  });

  it("handles non-Error throw gracefully", () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockImplementation(() => {
      throw "string error";
    });

    const result = discoverSubscriptionProviders(mockLogger);
    expect(result).toEqual([]);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      "[manifest] Error scanning auth profiles: string error",
    );
  });

  it("extracts access_token from Copilot auth-profile", () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue([
      { name: "agent-1", isDirectory: () => true } as any,
    ]);
    mockReadFileSync.mockReturnValue(
      JSON.stringify({
        profiles: {
          "copilot-device": {
            type: "device_login",
            provider: "github-copilot",
            access_token: "ghu_copilot_token_123",
          },
        },
      }),
    );

    const result = discoverSubscriptionProviders(mockLogger);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      openclawId: "github-copilot",
      manifestId: "copilot",
      authType: "device_login",
      token: "ghu_copilot_token_123",
    });
  });

  it("falls back to key field when access_token is absent for Copilot", () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue([
      { name: "agent-1", isDirectory: () => true } as any,
    ]);
    mockReadFileSync.mockReturnValue(
      JSON.stringify({
        profiles: {
          "copilot-key": {
            type: "device_login",
            provider: "github-copilot",
            key: "ghu_fallback_key_456",
          },
        },
      }),
    );

    const result = discoverSubscriptionProviders(mockLogger);
    expect(result).toHaveLength(1);
    expect(result[0].token).toBe("ghu_fallback_key_456");
  });

  it("omits token for non-Copilot providers", () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue([
      { name: "agent-1", isDirectory: () => true } as any,
    ]);
    mockReadFileSync.mockReturnValue(
      JSON.stringify({
        profiles: {
          "anthropic-oauth": {
            type: "oauth",
            provider: "anthropic",
            access_token: "should-not-be-extracted",
          },
        },
      }),
    );

    const result = discoverSubscriptionProviders(mockLogger);
    expect(result).toHaveLength(1);
    expect(result[0].token).toBeUndefined();
  });

  it("handles malformed JSON in auth-profiles.json", () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue([
      { name: "agent-1", isDirectory: () => true } as any,
    ]);
    mockReadFileSync.mockReturnValue("not valid json");

    const result = discoverSubscriptionProviders(mockLogger);
    expect(result).toEqual([]);
  });

  it("maps all known OpenClaw provider aliases", () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue([
      { name: "agent-1", isDirectory: () => true } as any,
    ]);
    mockReadFileSync.mockReturnValue(
      JSON.stringify({
        profiles: {
          a: { type: "oauth", provider: "google-gemini" },
          b: { type: "oauth", provider: "github-copilot" },
          c: { type: "oauth", provider: "qwen-portal" },
          d: { type: "oauth", provider: "kimi" },
          e: { type: "oauth", provider: "minimax" },
        },
      }),
    );

    const result = discoverSubscriptionProviders(mockLogger);
    const ids = result.map((p) => p.manifestId).sort();
    expect(ids).toEqual(["copilot", "gemini", "minimax", "moonshot", "qwen"]);
  });
});

describe("registerSubscriptionProviders", () => {
  const mockProviders: SubscriptionProvider[] = [
    { openclawId: "anthropic", manifestId: "anthropic", authType: "oauth" },
    { openclawId: "openai-codex", manifestId: "openai", authType: "setup_token" },
  ];

  const mockFetch = jest.fn();
  beforeEach(() => {
    global.fetch = mockFetch;
  });

  it("does nothing when providers array is empty", async () => {
    await registerSubscriptionProviders([], "http://localhost/otlp", "key", mockLogger);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("posts providers to the subscription endpoint", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ registered: 2 }),
    });

    await registerSubscriptionProviders(
      mockProviders,
      "http://localhost:38238/otlp",
      "mnfst_test",
      mockLogger,
    );

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:38238/api/v1/routing/subscription-providers",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer mnfst_test",
        }),
        body: JSON.stringify({
          providers: [{ provider: "anthropic" }, { provider: "openai" }],
        }),
      }),
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      "[manifest] Registered 2 subscription provider(s)",
    );
  });

  it("includes token in registration payload when present", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ registered: 1 }),
    });

    const providersWithToken: SubscriptionProvider[] = [
      {
        openclawId: "github-copilot",
        manifestId: "copilot",
        authType: "device_login",
        token: "ghu_copilot_token",
      },
    ];

    await registerSubscriptionProviders(
      providersWithToken,
      "http://localhost:38238/otlp",
      "mnfst_test",
      mockLogger,
    );

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.providers).toEqual([
      { provider: "copilot", token: "ghu_copilot_token" },
    ]);
  });

  it("strips /otlp/v1 suffix from endpoint", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ registered: 1 }),
    });

    await registerSubscriptionProviders(
      [mockProviders[0]],
      "http://localhost:38238/otlp/v1",
      "key",
      mockLogger,
    );

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:38238/api/v1/routing/subscription-providers",
      expect.anything(),
    );
  });

  it("omits Authorization header when apiKey is empty", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ registered: 1 }),
    });

    await registerSubscriptionProviders(
      [mockProviders[0]],
      "http://localhost/otlp",
      "",
      mockLogger,
    );

    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers).not.toHaveProperty("Authorization");
  });

  it("logs debug on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });

    await registerSubscriptionProviders(
      mockProviders,
      "http://localhost/otlp",
      "key",
      mockLogger,
    );

    expect(mockLogger.debug).toHaveBeenCalledWith(
      "[manifest] Failed to register subscription providers: 401",
    );
  });

  it("handles fetch error gracefully", async () => {
    mockFetch.mockRejectedValueOnce(new Error("connection refused"));

    await registerSubscriptionProviders(
      mockProviders,
      "http://localhost/otlp",
      "key",
      mockLogger,
    );

    expect(mockLogger.debug).toHaveBeenCalledWith(
      "[manifest] Error registering subscription providers: connection refused",
    );
  });

  it("handles non-Error fetch rejection", async () => {
    mockFetch.mockRejectedValueOnce("timeout");

    await registerSubscriptionProviders(
      mockProviders,
      "http://localhost/otlp",
      "key",
      mockLogger,
    );

    expect(mockLogger.debug).toHaveBeenCalledWith(
      "[manifest] Error registering subscription providers: timeout",
    );
  });
});
