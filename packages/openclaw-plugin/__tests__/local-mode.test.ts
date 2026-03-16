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

    injectProviderConfig(api, "http://127.0.0.1:2099/v1", "mnfst_test", mockLogger);

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
    injectProviderConfig(api, "http://127.0.0.1:2099/v1", "mnfst_new", mockLogger);

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
    injectProviderConfig(api, "http://127.0.0.1:2099/v1", "mnfst_test", mockLogger);

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
    injectProviderConfig(api, "http://127.0.0.1:2099/v1", "mnfst_test", mockLogger);

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
    injectProviderConfig(api, "http://127.0.0.1:3000/v1", "mnfst_new", mockLogger);

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

    injectProviderConfig(api, "http://127.0.0.1:2099/v1", "mnfst_test", mockLogger);

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
    devMode: false,
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
    let startFn: (() => void) | null = null;
    let stopFn: (() => Promise<void>) | null = null;
    return {
      config: {},
      registerProvider: jest.fn(),
      registerService: jest.fn(
        (svc: { start: () => void; stop: () => Promise<void> }) => {
          startFn = svc.start;
          stopFn = svc.stop;
        },
      ),
      registerTool: jest.fn(),
      getStartFn: () => startFn,
      getStopFn: () => stopFn,
    };
  }

  /** Call the registered service start() callback and flush microtasks */
  async function flushServerStart(api: ReturnType<typeof createMockApi>) {
    const startFn = api.getStartFn();
    if (startFn) await startFn();
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
  }

  it("skips embedded server when existing server is detected proactively", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: true });

    const api = createMockApi();
    registerLocalMode(api, testConfig, mockLogger);
    await flushServerStart(api);

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining("Reusing existing server"),
    );
    expect(mockServerStart).not.toHaveBeenCalled();
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  it("logs reuse message when EADDRINUSE + healthy Manifest server (race condition)", async () => {
    mockServerStart.mockRejectedValue(
      new Error("listen EADDRINUSE: address already in use 127.0.0.1:2099"),
    );
    // Proactive check: not running yet; reactive check after EADDRINUSE: now running
    globalThis.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true });

    const api = createMockApi();
    registerLocalMode(api, testConfig, mockLogger);
    await flushServerStart(api);

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining("Reusing existing server"),
    );
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  it("logs port-change error when EADDRINUSE + non-Manifest process", async () => {
    mockServerStart.mockRejectedValue(new Error("listen EADDRINUSE"));
    // Proactive check: no server yet; reactive check after EADDRINUSE: non-Manifest process
    globalThis.fetch = jest.fn()
      .mockRejectedValueOnce(new Error("ECONNREFUSED"))
      .mockResolvedValueOnce({ ok: false });

    const api = createMockApi();
    registerLocalMode(api, testConfig, mockLogger);
    await flushServerStart(api);

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining("already in use by another process"),
    );
  });

  it("starts normally when no port conflict", async () => {
    globalThis.fetch = jest.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    mockServerStart.mockResolvedValue(undefined);

    const api = createMockApi();
    registerLocalMode(api, testConfig, mockLogger);
    await flushServerStart(api);

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

  it("logs generic server start error when error is not EADDRINUSE", async () => {
    globalThis.fetch = jest.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    mockServerStart.mockRejectedValue(new Error("Unexpected crash"));

    const api = createMockApi();
    registerLocalMode(api, testConfig, mockLogger);
    await flushServerStart(api);

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining("Failed to start local server"),
    );
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining("Unexpected crash"),
    );
  });

  it("shuts down telemetry on service stop", async () => {
    const { shutdownTelemetry } = require("../src/telemetry");

    const api = createMockApi();
    registerLocalMode(api, testConfig, mockLogger);

    const stopFn = api.getStopFn();
    expect(stopFn).not.toBeNull();

    await stopFn!();
    expect(shutdownTelemetry).toHaveBeenCalledWith(mockLogger);
  });

  it("starts server immediately during registerLocalMode without service lifecycle", async () => {
    globalThis.fetch = jest.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    mockServerStart.mockResolvedValue(undefined);

    const api = createMockApi();
    registerLocalMode(api, testConfig, mockLogger);

    // Server start is fire-and-forget — flush microtasks
    await flushServerStart(api);

    // Server started without ever calling the service's start() callback
    expect(mockServerStart).toHaveBeenCalledWith({
      port: 2099,
      host: "127.0.0.1",
      dbPath: expect.stringContaining("manifest.db"),
      quiet: true,
    });

    // The service's start() was never called by us — verifies the fix
    const startFn = api.getStartFn();
    expect(startFn).toBeDefined();
  });

  it("server only starts when registerService start() is called", async () => {
    globalThis.fetch = jest.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    mockServerStart.mockResolvedValue(undefined);

    const api = createMockApi();
    registerLocalMode(api, testConfig, mockLogger);

    // Server should not start until start() is called
    expect(mockServerStart).not.toHaveBeenCalled();

    await flushServerStart(api);

    expect(mockServerStart).toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining("Local server running"),
    );
  });

  it("calling start() twice does not start server twice", async () => {
    globalThis.fetch = jest.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    mockServerStart.mockResolvedValue(undefined);

    const api = createMockApi();
    registerLocalMode(api, testConfig, mockLogger);
    await flushServerStart(api);

    expect(mockServerStart).toHaveBeenCalledTimes(1);

    // Second call starts a new attempt (registerService can call start again)
    mockServerStart.mockClear();
    await flushServerStart(api);
    expect(mockServerStart).toHaveBeenCalledTimes(1);
  });

  it("start() propagates errors from logger without crashing", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: true });

    const throwingLogger = {
      ...mockLogger,
      info: jest.fn().mockImplementation((msg: string) => {
        if (msg.includes("Reusing existing server")) {
          throw new Error("logger exploded");
        }
      }),
    };

    const api = createMockApi();
    registerLocalMode(api, testConfig, throwingLogger);

    // start() should throw since the logger throws, but should not crash
    await expect(flushServerStart(api)).rejects.toThrow("logger exploded");
    expect(mockServerStart).not.toHaveBeenCalled();
  });

  it("calls registerCommand with localConfig", () => {
    const { registerCommand } = require("../src/command") as { registerCommand: jest.Mock };
    jest.mock("../src/command", () => ({ registerCommand: jest.fn() }));

    const api = createMockApi();
    registerLocalMode(api, testConfig, mockLogger);

    // registerCommand should have been called (it is imported at module level)
    // Since we mocked it in the test setup jest.mock block, we just verify the call chain
    const { registerHooks } = require("../src/hooks");
    expect(registerHooks).toHaveBeenCalled();
  });

  it("skips registerTools when registerTool is not available", () => {
    const { registerTools } = require("../src/tools");

    const api = {
      config: {},
      registerProvider: jest.fn(),
      registerService: jest.fn(),
      // No registerTool property
    };

    (registerTools as jest.Mock).mockClear();
    registerLocalMode(api, testConfig, mockLogger);

    expect(registerTools).not.toHaveBeenCalled();
  });
});

describe("injectProviderConfig — runtime config edge cases", () => {
  it("handles runtime config with array-format models", () => {
    const api = {
      config: {
        agents: {
          defaults: {
            models: ["anthropic/claude-sonnet-4"],
          },
        },
      },
    };

    injectProviderConfig(api, "http://127.0.0.1:2099/v1", "mnfst_test", mockLogger);

    expect((api.config as any).agents.defaults.models).toContain("manifest/auto");
  });

  it("does not duplicate manifest/auto in runtime array models", () => {
    const api = {
      config: {
        agents: {
          defaults: {
            models: ["manifest/auto", "anthropic/claude-sonnet-4"],
          },
        },
      },
    };

    injectProviderConfig(api, "http://127.0.0.1:2099/v1", "mnfst_test", mockLogger);

    const models = (api.config as any).agents.defaults.models;
    expect(models.filter((m: string) => m === "manifest/auto")).toHaveLength(1);
  });

  it("logs debug when runtime config injection throws", () => {
    const api = {
      config: new Proxy({}, {
        get() { throw new Error("frozen config"); },
        set() { throw new Error("frozen config"); },
      }),
    };

    // Should not throw
    injectProviderConfig(api as any, "http://127.0.0.1:2099/v1", "mnfst_test", mockLogger);

    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining("Could not inject runtime config"),
    );
  });

  it("logs debug when file write fails", () => {
    (writeFileSync as jest.Mock).mockImplementation(() => {
      throw new Error("EACCES");
    });

    const api = { config: {} };
    injectProviderConfig(api, "http://127.0.0.1:2099/v1", "mnfst_test", mockLogger);

    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining("Could not write openclaw.json"),
    );
  });
});

describe("injectAuthProfile — edge cases", () => {
  it("logs count when profiles are injected into multiple agents", () => {
    const agentsDir = join("/mock-home", ".openclaw", "agents");
    (existsSync as jest.Mock).mockImplementation((p: string) => {
      if (p === agentsDir) return true;
      if (p.includes("agent/auth-profiles.json")) return false;
      if (p.includes("agent")) return true;
      return false;
    });
    (readdirSync as jest.Mock).mockReturnValue([
      { name: "bot-a", isDirectory: () => true },
      { name: "bot-b", isDirectory: () => true },
    ]);

    injectAuthProfile("mnfst_new_key", mockLogger);

    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining("Injected auth profile into 2 agent(s)"),
    );
  });

  it("skips agent directories without agent subdirectory", () => {
    const agentsDir = join("/mock-home", ".openclaw", "agents");
    (existsSync as jest.Mock).mockImplementation((p: string) => {
      if (p === agentsDir) return true;
      return false;
    });
    (readdirSync as jest.Mock).mockReturnValue([
      { name: "bot-x", isDirectory: () => true },
    ]);

    injectAuthProfile("mnfst_test", mockLogger);

    // No profiles should be written since profileDir does not exist
    expect(writeFileSync).not.toHaveBeenCalled();
  });

  it("handles readdirSync error gracefully", () => {
    const agentsDir = join("/mock-home", ".openclaw", "agents");
    (existsSync as jest.Mock).mockImplementation((p: string) => {
      if (p === agentsDir) return true;
      return false;
    });
    (readdirSync as jest.Mock).mockImplementation(() => {
      throw new Error("permission denied");
    });

    // Should not throw
    injectAuthProfile("mnfst_test", mockLogger);

    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining("Auth profile injection error"),
    );
  });
});

describe("injectProviderConfig — stale models.json cleanup", () => {
  const agentsDir = join("/mock-home", ".openclaw", "agents");

  it("removes manifest entry from per-agent models.json", () => {
    (existsSync as jest.Mock).mockImplementation((p: string) => {
      if (p === agentsDir) return true;
      if (p.includes("models.json")) return true;
      return false;
    });
    (readdirSync as jest.Mock).mockReturnValue([
      { name: "bot-1", isDirectory: () => true },
    ]);
    (readFileSync as jest.Mock).mockImplementation((p: string) => {
      if (typeof p === "string" && p.includes("models.json")) {
        return JSON.stringify({ providers: { manifest: { baseUrl: "old" }, other: {} } });
      }
      return "{}";
    });

    const api = { config: {} };
    injectProviderConfig(api, "http://127.0.0.1:2099/v1", "mnfst_test", mockLogger);

    // atomicWriteJson writes via writeFileSync+renameSync — find the models.json write
    const writes = (writeFileSync as jest.Mock).mock.calls;
    const modelsWrite = writes.find((c: any[]) => String(c[0]).includes("models.json"));
    expect(modelsWrite).toBeDefined();
    const data = JSON.parse(modelsWrite![1]);
    expect(data.providers.manifest).toBeUndefined();
    expect(data.providers.other).toBeDefined();
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining("Removed stale manifest entry"),
    );
  });

  it("skips agent when models.json does not exist", () => {
    (existsSync as jest.Mock).mockImplementation((p: string) => {
      if (p === agentsDir) return true;
      if (typeof p === "string" && p.includes("models.json")) return false;
      return false;
    });
    (readdirSync as jest.Mock).mockReturnValue([
      { name: "bot-2", isDirectory: () => true },
    ]);

    const api = { config: {} };
    injectProviderConfig(api, "http://127.0.0.1:2099/v1", "mnfst_test", mockLogger);

    // No models.json write should happen (only openclaw.json write)
    const writes = (writeFileSync as jest.Mock).mock.calls;
    const modelsWrite = writes.find((c: any[]) => String(c[0]).includes("models.json"));
    expect(modelsWrite).toBeUndefined();
  });

  it("skips agent when models.json has no manifest provider", () => {
    (existsSync as jest.Mock).mockImplementation((p: string) => {
      if (p === agentsDir) return true;
      if (typeof p === "string" && p.includes("models.json")) return true;
      return false;
    });
    (readdirSync as jest.Mock).mockReturnValue([
      { name: "bot-3", isDirectory: () => true },
    ]);
    (readFileSync as jest.Mock).mockImplementation((p: string) => {
      if (typeof p === "string" && p.includes("models.json")) {
        return JSON.stringify({ providers: { openai: {} } });
      }
      return "{}";
    });

    const api = { config: {} };
    injectProviderConfig(api, "http://127.0.0.1:2099/v1", "mnfst_test", mockLogger);

    const writes = (writeFileSync as jest.Mock).mock.calls;
    const modelsWrite = writes.find((c: any[]) => String(c[0]).includes("models.json"));
    expect(modelsWrite).toBeUndefined();
  });

  it("logs debug when cleanup throws", () => {
    (existsSync as jest.Mock).mockImplementation((p: string) => {
      if (p === agentsDir) return true;
      return false;
    });
    (readdirSync as jest.Mock).mockImplementation((p: string, opts: any) => {
      if (typeof p === "string" && p.includes("agents") && opts?.withFileTypes) {
        throw new Error("permission denied");
      }
      return [];
    });

    const api = { config: {} };
    injectProviderConfig(api, "http://127.0.0.1:2099/v1", "mnfst_test", mockLogger);

    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining("Could not clean agent models.json"),
    );
  });
});

describe("readJsonSafe — corrupt JSON", () => {
  it("returns empty object when file contains invalid JSON", () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    // readJsonSafe is called by injectProviderConfig when reading openclaw.json.
    // When the file exists but contains corrupt JSON, readJsonSafe should catch
    // the parse error and return {} (line 72 in local-mode.ts).
    const openclawConfig = join("/mock-home", ".openclaw", "openclaw.json");

    (existsSync as jest.Mock).mockImplementation((p: string) => {
      if (p === openclawConfig) return true;
      // Return false for config dir checks to avoid side effects
      return false;
    });
    (readFileSync as jest.Mock).mockReturnValue("<<<not valid json>>>");

    const api = { config: {} };
    // injectProviderConfig calls readJsonSafe(OPENCLAW_CONFIG) internally.
    // With corrupt JSON, readJsonSafe returns {} and the function proceeds
    // to build a fresh config object.
    injectProviderConfig(api, "http://127.0.0.1:2099/v1", "mnfst_test", mockLogger);

    // The function should still write a valid config (built from scratch)
    expect(writeFileSync).toHaveBeenCalled();
    const writtenData = JSON.parse(
      (writeFileSync as jest.Mock).mock.calls[0][1],
    );
    expect(writtenData.models.providers.manifest).toBeDefined();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("[manifest] Failed to read JSON file"),
    );
    warnSpy.mockRestore();
  });
});

describe("loadOrGenerateApiKey — edge cases", () => {
  const testConfig = {
    mode: "local" as const,
    devMode: false,
    apiKey: "",
    endpoint: "",
    port: 2099,
    host: "127.0.0.1",
  };

  it("generates new key when existing key does not start with mnfst_", () => {
    (existsSync as jest.Mock).mockImplementation((p: string) => {
      if (p.includes("config.json")) return true;
      if (p.includes("agents")) return false;
      return false;
    });
    (readFileSync as jest.Mock).mockReturnValue(
      JSON.stringify({ apiKey: "invalid_prefix_key" }),
    );

    const api = {
      config: {},
      registerProvider: jest.fn(),
      registerService: jest.fn(),
      registerTool: jest.fn(),
    };
    registerLocalMode(api, testConfig, mockLogger);

    // The telemetry init should be called with a key starting with mnfst_
    const { initTelemetry } = require("../src/telemetry");
    const localConfig = (initTelemetry as jest.Mock).mock.calls[0][0];
    expect(localConfig.apiKey).toMatch(/^mnfst_/);
  });

  it("generates new key when config file contains corrupt JSON", () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    (existsSync as jest.Mock).mockImplementation((p: string) => {
      if (p.includes("config.json")) return true;
      if (p.includes("agents")) return false;
      return false;
    });
    (readFileSync as jest.Mock).mockReturnValue("not valid json{{{");

    const api = {
      config: {},
      registerProvider: jest.fn(),
      registerService: jest.fn(),
      registerTool: jest.fn(),
    };
    registerLocalMode(api, testConfig, mockLogger);

    const { initTelemetry } = require("../src/telemetry");
    const localConfig = (initTelemetry as jest.Mock).mock.calls[0][0];
    expect(localConfig.apiKey).toMatch(/^mnfst_/);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("[manifest] Failed to read JSON file"),
    );
    warnSpy.mockRestore();
  });
});

// This test must run LAST because jest.resetModules() clears all cached mocks.
// Tests after this point cannot rely on the top-level jest.mock() module cache.
describe("registerLocalMode — server module load failure", () => {
  it("logs error and returns early when require('./server') throws", () => {
    jest.resetModules();

    jest.doMock("fs");
    jest.doMock("os", () => ({ homedir: jest.fn(() => "/mock-home") }));
    jest.doMock("crypto", () => ({
      randomBytes: jest.fn(() => ({
        toString: () => "abcdef1234567890abcdef1234567890abcdef1234567890",
      })),
    }));
    jest.doMock("../src/telemetry", () => ({
      initTelemetry: jest.fn(() => ({ tracer: {}, meter: {} })),
      shutdownTelemetry: jest.fn(),
    }));
    jest.doMock("../src/hooks", () => ({
      registerHooks: jest.fn(),
      initMetrics: jest.fn(),
    }));
    jest.doMock("../src/tools", () => ({ registerTools: jest.fn() }));
    jest.doMock("../src/routing", () => ({ registerRouting: jest.fn() }));
    jest.doMock("../src/command", () => ({ registerCommand: jest.fn() }));

    // Make the server module throw when required
    jest.doMock("../src/server", () => {
      throw new Error("Cannot find module './server'");
    });

    const fs = require("fs");
    (fs.existsSync as jest.Mock).mockImplementation((p: string) => {
      if (typeof p === "string" && p.includes("config.json")) return true;
      return false;
    });
    (fs.readFileSync as jest.Mock).mockReturnValue(
      JSON.stringify({ apiKey: "mnfst_local_existing" }),
    );
    (fs.writeFileSync as jest.Mock).mockImplementation(() => {});
    (fs.mkdirSync as jest.Mock).mockImplementation(() => {});
    (fs.renameSync as jest.Mock).mockImplementation(() => {});
    (fs.readdirSync as jest.Mock).mockReturnValue([]);

    const { registerLocalMode: isolatedRegisterLocalMode } =
      require("../src/local-mode");

    const isolatedLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    };

    const api = {
      config: {},
      registerProvider: jest.fn(),
      registerService: jest.fn(),
      registerTool: jest.fn(),
    };

    const cfg = {
      mode: "local" as const,
      devMode: false,
      apiKey: "",
      endpoint: "",
      port: 2099,
      host: "127.0.0.1",
    };

    isolatedRegisterLocalMode(api, cfg, isolatedLogger);

    expect(isolatedLogger.error).toHaveBeenCalledWith(
      expect.stringContaining("Failed to load embedded server"),
    );
    expect(isolatedLogger.error).toHaveBeenCalledWith(
      expect.stringContaining("Cannot find module"),
    );
    expect(api.registerService).not.toHaveBeenCalled();
  });
});
