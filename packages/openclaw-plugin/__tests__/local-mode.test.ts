import { join } from "path";


// Mock fs, os, crypto before importing the module
jest.mock("fs");
jest.mock("os", () => ({ homedir: jest.fn(() => "/mock-home") }));
jest.mock("crypto", () => ({
  randomBytes: jest.fn(() => ({
    toString: () => "abcdef1234567890abcdef1234567890abcdef1234567890",
  })),
}));

// Mock telemetry, hooks, tools to isolate local-mode logic
jest.mock("../src/telemetry", () => ({
  initTelemetry: jest.fn(() => ({ tracer: {}, meter: {} })),
  shutdownTelemetry: jest.fn(),
}));
jest.mock("../src/hooks", () => ({
  registerHooks: jest.fn(),
  initMetrics: jest.fn(),
}));
jest.mock("../src/tools", () => ({ registerTools: jest.fn() }));

// Mock the embedded server module (require("./server") in local-mode.ts)
const mockServerStart = jest.fn();
jest.mock("../src/server", () => ({ start: mockServerStart }));

import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  renameSync,
} from "fs";
import {
  injectProviderConfig,
  injectAuthProfile,
  checkExistingServer,
  registerLocalMode,
} from "../src/local-mode";

const mockLogger = {
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  (existsSync as jest.Mock).mockReturnValue(false);
  (readFileSync as jest.Mock).mockReturnValue("{}");
  (writeFileSync as jest.Mock).mockImplementation(() => {});
  (mkdirSync as jest.Mock).mockImplementation(() => {});
  (renameSync as jest.Mock).mockImplementation(() => {});
  (readdirSync as jest.Mock).mockReturnValue([]);
  mockServerStart.mockResolvedValue(undefined);
});

describe("injectProviderConfig", () => {
  it("writes correct provider config to openclaw.json", () => {
    const api = { config: {} };

    injectProviderConfig(api, "127.0.0.1", 2099, "mnfst_test", mockLogger);

    expect(writeFileSync).toHaveBeenCalled();
    const writtenData = JSON.parse(
      (writeFileSync as jest.Mock).mock.calls[0][1],
    );
    expect(writtenData.models.providers.manifest).toEqual({
      baseUrl: "http://127.0.0.1:2099/v1",
      api: "openai-completions",
      apiKey: "mnfst_test",
      models: [{ id: "auto", name: "auto" }],
    });
    expect(writtenData.agents.defaults.models).toHaveProperty("manifest/auto");
  });

  it("is idempotent — does not duplicate manifest/auto in models object", () => {
    const existingConfig = {
      models: {
        providers: {
          manifest: {
            baseUrl: "http://127.0.0.1:2099/v1",
            api: "openai-completions",
            apiKey: "mnfst_old",
            models: [{ id: "auto", name: "auto" }],
          },
        },
      },
      agents: {
        defaults: {
          models: {
            "manifest/auto": {},
            "anthropic/claude-sonnet-4": {},
          },
        },
      },
    };
    (existsSync as jest.Mock).mockReturnValue(true);
    (readFileSync as jest.Mock).mockReturnValue(
      JSON.stringify(existingConfig),
    );

    const api = { config: {} };
    injectProviderConfig(api, "127.0.0.1", 2099, "mnfst_new", mockLogger);

    const writtenData = JSON.parse(
      (writeFileSync as jest.Mock).mock.calls[0][1],
    );
    expect(writtenData.agents.defaults.models).toHaveProperty("manifest/auto");
    expect(writtenData.agents.defaults.models).toHaveProperty("anthropic/claude-sonnet-4");
  });

  it("handles legacy array format for models allowlist", () => {
    const existingConfig = {
      agents: {
        defaults: {
          models: ["anthropic/claude-sonnet-4"],
        },
      },
    };
    (existsSync as jest.Mock).mockReturnValue(true);
    (readFileSync as jest.Mock).mockReturnValue(
      JSON.stringify(existingConfig),
    );

    const api = { config: {} };
    injectProviderConfig(api, "127.0.0.1", 2099, "mnfst_test", mockLogger);

    const writtenData = JSON.parse(
      (writeFileSync as jest.Mock).mock.calls[0][1],
    );
    expect(writtenData.agents.defaults.models).toContain("manifest/auto");
  });

  it("preserves other plugins' provider config", () => {
    const existingConfig = {
      models: {
        providers: {
          clawrouter: {
            baseUrl: "http://127.0.0.1:3000/v1",
            api: "openai-completions",
            apiKey: "cr_key",
          },
        },
      },
    };
    (existsSync as jest.Mock).mockReturnValue(true);
    (readFileSync as jest.Mock).mockReturnValue(
      JSON.stringify(existingConfig),
    );

    const api = { config: {} };
    injectProviderConfig(api, "127.0.0.1", 2099, "mnfst_test", mockLogger);

    const writtenData = JSON.parse(
      (writeFileSync as jest.Mock).mock.calls[0][1],
    );
    expect(writtenData.models.providers.clawrouter).toBeDefined();
    expect(writtenData.models.providers.clawrouter.apiKey).toBe("cr_key");
    expect(writtenData.models.providers.manifest).toBeDefined();
  });

  it("updates port/baseUrl when config changes", () => {
    const existingConfig = {
      models: {
        providers: {
          manifest: {
            baseUrl: "http://127.0.0.1:2099/v1",
            api: "openai-completions",
            apiKey: "mnfst_old",
            models: [{ id: "auto", name: "auto" }],
          },
        },
      },
    };
    (existsSync as jest.Mock).mockReturnValue(true);
    (readFileSync as jest.Mock).mockReturnValue(
      JSON.stringify(existingConfig),
    );

    const api = { config: {} };
    injectProviderConfig(api, "127.0.0.1", 3000, "mnfst_new", mockLogger);

    const writtenData = JSON.parse(
      (writeFileSync as jest.Mock).mock.calls[0][1],
    );
    expect(writtenData.models.providers.manifest.baseUrl).toBe(
      "http://127.0.0.1:3000/v1",
    );
    expect(writtenData.models.providers.manifest.apiKey).toBe("mnfst_new");
  });

  it("sets runtime config on api.config", () => {
    const api = { config: {} };

    injectProviderConfig(api, "127.0.0.1", 2099, "mnfst_test", mockLogger);

    expect(api.config).toEqual(
      expect.objectContaining({
        models: expect.objectContaining({
          providers: expect.objectContaining({
            manifest: expect.objectContaining({
              baseUrl: "http://127.0.0.1:2099/v1",
            }),
          }),
        }),
      }),
    );
  });
});

describe("injectAuthProfile", () => {
  it("creates correct auth profile format for each agent", () => {
    const agentsDir = join("/mock-home", ".openclaw", "agents");
    (existsSync as jest.Mock).mockImplementation((p: string) => {
      if (p === agentsDir) return true;
      if (p.includes("agent/auth-profiles.json")) return false;
      if (p.includes("agent")) return true;
      return false;
    });
    (readdirSync as jest.Mock).mockReturnValue([
      { name: "my-bot", isDirectory: () => true },
    ]);

    injectAuthProfile("mnfst_test", mockLogger);

    expect(writeFileSync).toHaveBeenCalled();
    const writtenData = JSON.parse(
      (writeFileSync as jest.Mock).mock.calls[0][1],
    );
    expect(writtenData.version).toBe(1);
    expect(writtenData.profiles["manifest:default"]).toEqual({
      type: "api_key",
      provider: "manifest",
      key: "mnfst_test",
    });
  });

  it("skips agents that already have the correct profile", () => {
    const agentsDir = join("/mock-home", ".openclaw", "agents");
    const profilePath = join(
      agentsDir, "my-bot", "agent", "auth-profiles.json",
    );

    (existsSync as jest.Mock).mockImplementation((p: string) => {
      if (p === agentsDir) return true;
      if (p === profilePath) return true;
      if (p.includes("agent")) return true;
      return false;
    });
    (readdirSync as jest.Mock).mockReturnValue([
      { name: "my-bot", isDirectory: () => true },
    ]);
    (readFileSync as jest.Mock).mockImplementation((p: string) => {
      if (p === profilePath) {
        return JSON.stringify({
          version: 1,
          profiles: {
            "manifest:default": {
              type: "api_key",
              provider: "manifest",
              key: "mnfst_test",
            },
          },
        });
      }
      return "{}";
    });

    injectAuthProfile("mnfst_test", mockLogger);

    expect(writeFileSync).not.toHaveBeenCalled();
  });

  it("skips when agents directory does not exist", () => {
    (existsSync as jest.Mock).mockReturnValue(false);

    injectAuthProfile("mnfst_test", mockLogger);

    expect(readdirSync).not.toHaveBeenCalled();
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining("No agents directory"),
    );
  });
});

describe("checkExistingServer", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns true when health endpoint responds OK", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: true });

    const result = await checkExistingServer("127.0.0.1", 2099);
    expect(result).toBe(true);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:2099/api/v1/health",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("returns false when health endpoint returns non-OK", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: false });

    const result = await checkExistingServer("127.0.0.1", 2099);
    expect(result).toBe(false);
  });

  it("returns false when fetch throws (no server running)", async () => {
    globalThis.fetch = jest
      .fn()
      .mockRejectedValue(new Error("ECONNREFUSED"));

    const result = await checkExistingServer("127.0.0.1", 2099);
    expect(result).toBe(false);
  });
});

describe("registerLocalMode — EADDRINUSE handling", () => {
  const originalFetch = globalThis.fetch;

  const testConfig = {
    mode: "local" as const,
    apiKey: "",
    endpoint: "",
    port: 2099,
    host: "127.0.0.1",
  };

  beforeEach(() => {
    (existsSync as jest.Mock).mockImplementation((p: string) => {
      if (p.includes("config.json")) return true;
      if (p.includes("agents")) return false;
      return false;
    });
    (readFileSync as jest.Mock).mockReturnValue(
      JSON.stringify({ apiKey: "mnfst_local_existing" }),
    );
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function createMockApi() {
    let startFn: (() => Promise<void>) | null = null;
    return {
      config: {},
      registerProvider: jest.fn(),
      registerService: jest.fn(
        (svc: { start: () => Promise<void> }) => {
          startFn = svc.start;
        },
      ),
      registerTool: jest.fn(),
      getStartFn: () => startFn,
    };
  }

  it("logs reuse message when EADDRINUSE + healthy Manifest server", async () => {
    mockServerStart.mockRejectedValue(
      new Error("listen EADDRINUSE: address already in use 127.0.0.1:2099"),
    );
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: true });

    const api = createMockApi();
    registerLocalMode(api, testConfig, mockLogger);

    const startFn = api.getStartFn();
    expect(startFn).not.toBeNull();

    jest.clearAllMocks();
    await startFn!();

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining("Reusing existing server"),
    );
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  it("logs port-change error when EADDRINUSE + non-Manifest process", async () => {
    mockServerStart.mockRejectedValue(new Error("listen EADDRINUSE"));
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: false });

    const api = createMockApi();
    registerLocalMode(api, testConfig, mockLogger);

    const startFn = api.getStartFn();
    jest.clearAllMocks();
    await startFn!();

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining("already in use by another process"),
    );
  });

  it("starts normally when no port conflict", async () => {
    mockServerStart.mockResolvedValue(undefined);

    const api = createMockApi();
    registerLocalMode(api, testConfig, mockLogger);

    const startFn = api.getStartFn();
    jest.clearAllMocks();
    await startFn!();

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining("Local server running"),
    );
  });

  it("sets endpoint to local server URL in localConfig", () => {
    const { initTelemetry } = require("../src/telemetry");
    const api = createMockApi();
    registerLocalMode(api, { ...testConfig, port: 2099, host: "127.0.0.1" }, mockLogger);

    const telemetryCall = (initTelemetry as jest.Mock).mock.calls[0];
    expect(telemetryCall[0].endpoint).toBe("http://127.0.0.1:2099/otlp");
  });
});
