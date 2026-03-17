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

    expect(result).toEqual([
      { openclawId: "anthropic", manifestId: "anthropic", authType: "oauth" },
      { openclawId: "openai-codex", manifestId: "openai", authType: "setup_token" },
    ]);
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

  it("handles malformed JSON in auth-profiles.json", () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue([
      { name: "agent-1", isDirectory: () => true } as any,
    ]);
    mockReadFileSync.mockReturnValue("not valid json");

    const result = discoverSubscriptionProviders(mockLogger);
    expect(result).toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("[manifest] Failed to read JSON file"),
    );
    warnSpy.mockRestore();
  });

  it("filters mapped providers that do not support Manifest subscription auth", () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue([
      { name: "agent-1", isDirectory: () => true } as any,
    ]);
    mockReadFileSync.mockReturnValue(
      JSON.stringify({
        profiles: {
          aa: { type: "oauth", provider: "anthropic" },
          a: { type: "oauth", provider: "google-gemini" },
          b: { type: "oauth", provider: "github-copilot" },
          c: { type: "oauth", provider: "qwen-portal" },
          d: { type: "oauth", provider: "kimi" },
          e: { type: "oauth", provider: "minimax" },
          f: { type: "oauth", provider: "minimax-portal" },
        },
      }),
    );

    const result = discoverSubscriptionProviders(mockLogger);
    expect(result).toEqual([
      { openclawId: "anthropic", manifestId: "anthropic", authType: "oauth" },
      { openclawId: "github-copilot", manifestId: "openai", authType: "oauth" },
      { openclawId: "minimax", manifestId: "minimax", authType: "oauth" },
    ]);
  });
});

describe("registerSubscriptionProviders", () => {
  const mockProviders: SubscriptionProvider[] = [
    { openclawId: "anthropic", manifestId: "anthropic", authType: "oauth" },
  ];

  const mockFetch = jest.fn();
  beforeEach(() => {
    const globalWithFetch = globalThis as typeof globalThis & { fetch: typeof mockFetch };
    globalWithFetch.fetch = mockFetch;
  });

  it("does nothing when providers array is empty", async () => {
    await registerSubscriptionProviders([], "http://localhost/otlp", "key", mockLogger);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("logs debug when global fetch is unavailable", async () => {
    const globalWithFetch = globalThis as typeof globalThis & { fetch?: typeof mockFetch };
    Reflect.deleteProperty(globalWithFetch, "fetch");

    await registerSubscriptionProviders(mockProviders, "http://localhost/otlp", "key", mockLogger);

    expect(mockLogger.debug).toHaveBeenCalledWith(
      "[manifest] Global fetch is not available",
    );
  });

  it("posts providers to the subscription endpoint", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ registered: 1 }),
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
          providers: [{ provider: "anthropic" }],
        }),
      }),
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      "[manifest] Registered 1 subscription provider(s)",
    );
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

  it("tolerates runtimes without AbortSignal.timeout", async () => {
    const abortSignalDescriptor = Object.getOwnPropertyDescriptor(globalThis, "AbortSignal");
    Object.defineProperty(globalThis, "AbortSignal", {
      configurable: true,
      value: {},
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ registered: 1 }),
    });

    try {
      await registerSubscriptionProviders(
        mockProviders,
        "http://localhost/otlp",
        "key",
        mockLogger,
      );
    } finally {
      if (abortSignalDescriptor) {
        Object.defineProperty(globalThis, "AbortSignal", abortSignalDescriptor);
      } else {
        Reflect.deleteProperty(globalThis, "AbortSignal");
      }
    }

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost/api/v1/routing/subscription-providers",
      expect.objectContaining({
        signal: undefined,
      }),
    );
  });
});
