const mockServerStart = jest.fn();

jest.mock("fs", () => ({
  existsSync: jest.fn(),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
  readdirSync: jest.fn(),
  renameSync: jest.fn(),
}));

jest.mock("os", () => ({
  homedir: () => "/mock-home",
}));

jest.mock("crypto", () => ({
  randomBytes: jest.fn(() => ({
    toString: () => "aabbccdd11223344aabbccdd11223344aabbccdd11223344",
  })),
}));

jest.mock("../src/json-file", () => ({
  loadJsonFile: jest.fn(() => ({})),
}));

jest.mock("../src/server", () => ({
  start: mockServerStart,
  version: "1.0.0",
}));

import { existsSync, writeFileSync, mkdirSync, readdirSync, renameSync } from "fs";
import { loadJsonFile } from "../src/json-file";
import {
  loadOrGenerateApiKey,
  injectProviderConfig,
  injectAuthProfile,
  checkExistingServer,
  registerLocalMode,
} from "../src/local-mode";

const mockExistsSync = existsSync as jest.MockedFunction<typeof existsSync>;
const mockWriteFileSync = writeFileSync as jest.MockedFunction<typeof writeFileSync>;
const mockMkdirSync = mkdirSync as jest.MockedFunction<typeof mkdirSync>;
const mockReaddirSync = readdirSync as jest.MockedFunction<typeof readdirSync>;
const mockRenameSync = renameSync as jest.MockedFunction<typeof renameSync>;
const mockLoadJsonFile = loadJsonFile as jest.MockedFunction<typeof loadJsonFile>;

function makeLogger() {
  return {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  };
}

const CONFIG_DIR = "/mock-home/.openclaw/manifest";
const CONFIG_FILE = "/mock-home/.openclaw/manifest/config.json";
const OPENCLAW_CONFIG = "/mock-home/.openclaw/openclaw.json";
const OPENCLAW_DIR = "/mock-home/.openclaw";

beforeEach(() => {
  jest.clearAllMocks();
  mockExistsSync.mockReturnValue(false);
  mockLoadJsonFile.mockReturnValue({});
});

// ---------------------------------------------------------------------------
// loadOrGenerateApiKey
// ---------------------------------------------------------------------------
describe("loadOrGenerateApiKey", () => {
  it("creates config dir when it does not exist", () => {
    mockExistsSync.mockReturnValue(false);

    loadOrGenerateApiKey();

    expect(mockMkdirSync).toHaveBeenCalledWith(CONFIG_DIR, {
      recursive: true,
      mode: 0o700,
    });
  });

  it("does not create config dir when it already exists", () => {
    mockExistsSync.mockImplementation((p) => String(p) === CONFIG_DIR);

    loadOrGenerateApiKey();

    expect(mockMkdirSync).not.toHaveBeenCalled();
  });

  it("returns existing key from config file when valid", () => {
    mockExistsSync.mockReturnValue(true);
    mockLoadJsonFile.mockReturnValue({ apiKey: "mnfst_existing_key_123" });

    const key = loadOrGenerateApiKey();

    expect(key).toBe("mnfst_existing_key_123");
    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  it("generates new key when config file exists but key has wrong prefix", () => {
    mockExistsSync.mockReturnValue(true);
    mockLoadJsonFile
      .mockReturnValueOnce({ apiKey: "wrong_prefix_key" })
      .mockReturnValueOnce({ apiKey: "wrong_prefix_key" });

    const key = loadOrGenerateApiKey();

    expect(key).toBe(
      "mnfst_local_aabbccdd11223344aabbccdd11223344aabbccdd11223344",
    );
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      CONFIG_FILE,
      expect.stringContaining("mnfst_local_"),
      { mode: 0o600 },
    );
  });

  it("generates new key when config file exists but apiKey is missing", () => {
    mockExistsSync.mockReturnValue(true);
    mockLoadJsonFile.mockReturnValue({});

    const key = loadOrGenerateApiKey();

    expect(key).toMatch(/^mnfst_local_/);
    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it("generates new key when config file does not exist", () => {
    mockExistsSync.mockImplementation((p) => String(p) === CONFIG_DIR);
    mockLoadJsonFile.mockReturnValue({});

    const key = loadOrGenerateApiKey();

    expect(key).toMatch(/^mnfst_local_/);
  });

  it("merges new key with existing config data", () => {
    mockExistsSync.mockImplementation((p) => String(p) === CONFIG_DIR);
    mockLoadJsonFile.mockReturnValue({ otherSetting: true });

    loadOrGenerateApiKey();

    const written = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string);
    expect(written.otherSetting).toBe(true);
    expect(written.apiKey).toMatch(/^mnfst_local_/);
  });
});

// ---------------------------------------------------------------------------
// injectProviderConfig
// ---------------------------------------------------------------------------
describe("injectProviderConfig", () => {
  const baseUrl = "http://127.0.0.1:2099/v1";
  const apiKey = "mnfst_test_key";

  it("writes provider config to openclaw.json", () => {
    const logger = makeLogger();
    const api = { config: {} };
    mockLoadJsonFile.mockReturnValue({});
    mockExistsSync.mockImplementation((p) => {
      if (String(p) === OPENCLAW_DIR) return true;
      return false;
    });

    injectProviderConfig(api, baseUrl, apiKey, logger);

    expect(mockRenameSync).toHaveBeenCalled();
    const tmpPath = mockWriteFileSync.mock.calls[0][0] as string;
    expect(tmpPath).toMatch(/openclaw\.json\.tmp\./);
    const written = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string);
    expect(written.models.providers.manifest.baseUrl).toBe(baseUrl);
    expect(written.models.providers.manifest.apiKey).toBe(apiKey);
    expect(written.models.providers.manifest.models).toEqual([
      { id: "auto", name: "auto" },
    ]);
    expect(logger.debug).toHaveBeenCalledWith(
      "[manifest] Wrote provider config to openclaw.json",
    );
  });

  it("adds manifest/auto to agents.defaults.models when it is an object", () => {
    const logger = makeLogger();
    const api = { config: {} };
    mockLoadJsonFile.mockReturnValue({
      agents: { defaults: { models: { "gpt-4": {} } } },
    });
    mockExistsSync.mockReturnValue(true);

    injectProviderConfig(api, baseUrl, apiKey, logger);

    const written = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string);
    expect(written.agents.defaults.models["manifest/auto"]).toEqual({});
    expect(written.agents.defaults.models["gpt-4"]).toEqual({});
  });

  it("does not duplicate manifest/auto when already present in object", () => {
    const logger = makeLogger();
    const api = { config: {} };
    mockLoadJsonFile.mockReturnValue({
      agents: {
        defaults: { models: { "manifest/auto": { existing: true } } },
      },
    });
    mockExistsSync.mockReturnValue(true);

    injectProviderConfig(api, baseUrl, apiKey, logger);

    const written = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string);
    expect(written.agents.defaults.models["manifest/auto"]).toEqual({
      existing: true,
    });
  });

  it("adds manifest/auto to agents.defaults.models when it is an array", () => {
    const logger = makeLogger();
    const api = { config: {} };
    mockLoadJsonFile.mockReturnValue({
      agents: { defaults: { models: ["gpt-4"] } },
    });
    mockExistsSync.mockReturnValue(true);

    injectProviderConfig(api, baseUrl, apiKey, logger);

    const written = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string);
    expect(written.agents.defaults.models).toContain("manifest/auto");
    expect(written.agents.defaults.models).toContain("gpt-4");
  });

  it("does not duplicate manifest/auto when already present in array", () => {
    const logger = makeLogger();
    const api = { config: {} };
    mockLoadJsonFile.mockReturnValue({
      agents: { defaults: { models: ["manifest/auto"] } },
    });
    mockExistsSync.mockReturnValue(true);

    injectProviderConfig(api, baseUrl, apiKey, logger);

    const written = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string);
    const count = written.agents.defaults.models.filter(
      (m: string) => m === "manifest/auto",
    ).length;
    expect(count).toBe(1);
  });

  it("logs debug message when writeFileSync throws", () => {
    const logger = makeLogger();
    const api = { config: {} };
    mockLoadJsonFile.mockReturnValue({});
    mockWriteFileSync.mockImplementationOnce(() => {
      throw new Error("EACCES: permission denied");
    });

    injectProviderConfig(api, baseUrl, apiKey, logger);

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining("Could not write openclaw.json"),
    );
  });

  it("logs debug with stringified error when error is not an Error instance", () => {
    const logger = makeLogger();
    const api = { config: {} };
    mockLoadJsonFile.mockImplementation(() => {
      throw "string error";
    });

    injectProviderConfig(api, baseUrl, apiKey, logger);

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining("string error"),
    );
  });

  it("cleans stale manifest entries from agent models.json files", () => {
    const logger = makeLogger();
    const api = { config: {} };
    const agentsDir = `${OPENCLAW_DIR}/agents`;

    let callCount = 0;
    mockLoadJsonFile.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return {}; // openclaw.json
      return { providers: { manifest: { old: true } } }; // models.json
    });

    mockExistsSync.mockImplementation((p) => {
      const path = String(p);
      if (path === agentsDir) return true;
      if (path.endsWith("models.json")) return true;
      if (path === OPENCLAW_DIR) return true;
      return false;
    });

    mockReaddirSync.mockReturnValue([
      { name: "agent1", isDirectory: () => true },
    ] as any);

    injectProviderConfig(api, baseUrl, apiKey, logger);

    // Two writes: one for openclaw.json, one for models.json
    expect(mockWriteFileSync).toHaveBeenCalledTimes(2);
    const modelsWritten = JSON.parse(
      mockWriteFileSync.mock.calls[1][1] as string,
    );
    expect(modelsWritten.providers.manifest).toBeUndefined();
  });

  it("skips agent models.json that does not exist", () => {
    const logger = makeLogger();
    const api = { config: {} };
    const agentsDir = `${OPENCLAW_DIR}/agents`;

    mockLoadJsonFile.mockReturnValueOnce({}); // openclaw.json

    mockExistsSync.mockImplementation((p) => {
      const path = String(p);
      if (path === agentsDir) return true;
      if (path === OPENCLAW_DIR) return true;
      if (path.endsWith("models.json")) return false;
      return false;
    });

    mockReaddirSync.mockReturnValue([
      { name: "agent1", isDirectory: () => true },
    ] as any);

    injectProviderConfig(api, baseUrl, apiKey, logger);

    // Only one write for openclaw.json, not for models.json
    expect(mockWriteFileSync).toHaveBeenCalledTimes(1);
  });

  it("skips agent models.json that has no manifest provider", () => {
    const logger = makeLogger();
    const api = { config: {} };
    const agentsDir = `${OPENCLAW_DIR}/agents`;

    let callCount = 0;
    mockLoadJsonFile.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return {}; // openclaw.json
      return { providers: { openai: {} } }; // models.json
    });

    mockExistsSync.mockImplementation((p) => {
      const path = String(p);
      if (path === agentsDir) return true;
      if (path === OPENCLAW_DIR) return true;
      if (path.endsWith("models.json")) return true;
      return false;
    });

    mockReaddirSync.mockReturnValue([
      { name: "agent1", isDirectory: () => true },
    ] as any);

    injectProviderConfig(api, baseUrl, apiKey, logger);

    // Only openclaw.json write
    expect(mockWriteFileSync).toHaveBeenCalledTimes(1);
  });

  it("skips stale cleanup when agents dir does not exist", () => {
    const logger = makeLogger();
    const api = { config: {} };

    mockLoadJsonFile.mockReturnValue({});
    mockExistsSync.mockImplementation((p) => {
      const path = String(p);
      if (path === OPENCLAW_DIR) return true;
      return false;
    });

    injectProviderConfig(api, baseUrl, apiKey, logger);

    expect(mockReaddirSync).not.toHaveBeenCalled();
  });

  it("silently handles error during stale cleanup", () => {
    const logger = makeLogger();
    const api = { config: {} };
    const agentsDir = `${OPENCLAW_DIR}/agents`;

    mockLoadJsonFile.mockReturnValueOnce({}); // openclaw.json

    mockExistsSync.mockImplementation((p) => {
      const path = String(p);
      if (path === agentsDir) return true;
      if (path === OPENCLAW_DIR) return true;
      return false;
    });

    mockReaddirSync.mockImplementation(() => {
      throw new Error("read error");
    });

    // Should not throw
    injectProviderConfig(api, baseUrl, apiKey, logger);
  });

  it("sets runtime config on api.config", () => {
    const logger = makeLogger();
    const api = { config: {} as any };
    mockLoadJsonFile.mockReturnValue({});
    mockExistsSync.mockReturnValue(true);

    injectProviderConfig(api, baseUrl, apiKey, logger);

    expect(api.config.models.providers.manifest.baseUrl).toBe(baseUrl);
    expect(api.config.agents.defaults.models["manifest/auto"]).toEqual({});
  });

  it("adds manifest/auto to runtime config models when it is an array", () => {
    const logger = makeLogger();
    const api = {
      config: {
        agents: { defaults: { models: ["gpt-4"] } },
      } as any,
    };
    mockLoadJsonFile.mockReturnValue({});
    mockExistsSync.mockReturnValue(true);

    injectProviderConfig(api, baseUrl, apiKey, logger);

    expect(api.config.agents.defaults.models).toContain("manifest/auto");
  });

  it("does not duplicate manifest/auto in runtime config array", () => {
    const logger = makeLogger();
    const api = {
      config: {
        agents: { defaults: { models: ["manifest/auto"] } },
      } as any,
    };
    mockLoadJsonFile.mockReturnValue({});
    mockExistsSync.mockReturnValue(true);

    injectProviderConfig(api, baseUrl, apiKey, logger);

    expect(api.config.agents.defaults.models.length).toBe(1);
  });

  it("does not duplicate manifest/auto in runtime config object", () => {
    const logger = makeLogger();
    const api = {
      config: {
        agents: {
          defaults: { models: { "manifest/auto": { x: 1 } } },
        },
      } as any,
    };
    mockLoadJsonFile.mockReturnValue({});
    mockExistsSync.mockReturnValue(true);

    injectProviderConfig(api, baseUrl, apiKey, logger);

    expect(api.config.agents.defaults.models["manifest/auto"]).toEqual({
      x: 1,
    });
  });

  it("handles api.config being null/undefined gracefully", () => {
    const logger = makeLogger();
    const api = { config: null };
    mockLoadJsonFile.mockReturnValue({});
    mockExistsSync.mockReturnValue(true);

    // Should not throw
    injectProviderConfig(api, baseUrl, apiKey, logger);
  });

  it("silently handles error during runtime config injection", () => {
    const logger = makeLogger();
    const api = {
      get config(): any {
        throw new Error("config error");
      },
    };
    mockLoadJsonFile.mockReturnValue({});
    mockExistsSync.mockReturnValue(true);

    // Should not throw
    injectProviderConfig(api, baseUrl, apiKey, logger);
  });

  it("creates dir in atomicWriteJson when dir does not exist", () => {
    const logger = makeLogger();
    const api = { config: {} };
    mockLoadJsonFile.mockReturnValue({});
    // OPENCLAW_DIR does not exist => atomicWriteJson creates it
    mockExistsSync.mockReturnValue(false);

    injectProviderConfig(api, baseUrl, apiKey, logger);

    expect(mockMkdirSync).toHaveBeenCalledWith(OPENCLAW_DIR, {
      recursive: true,
      mode: 0o700,
    });
  });
});

// ---------------------------------------------------------------------------
// injectAuthProfile
// ---------------------------------------------------------------------------
describe("injectAuthProfile", () => {
  const apiKey = "mnfst_test_key";
  const agentsDir = `${OPENCLAW_DIR}/agents`;

  it("skips if agents directory does not exist", () => {
    const logger = makeLogger();
    mockExistsSync.mockReturnValue(false);

    injectAuthProfile(apiKey, logger);

    expect(mockReaddirSync).not.toHaveBeenCalled();
  });

  it("injects profile into agent auth-profiles.json", () => {
    const logger = makeLogger();
    const agentPath = `${agentsDir}/agent1/agent`;

    mockExistsSync.mockImplementation((p) => {
      const path = String(p);
      if (path === agentsDir) return true;
      if (path === agentPath) return true;
      return true;
    });

    mockReaddirSync.mockReturnValue([
      { name: "agent1", isDirectory: () => true },
    ] as any);

    mockLoadJsonFile.mockReturnValue({});

    injectAuthProfile(apiKey, logger);

    expect(mockWriteFileSync).toHaveBeenCalled();
    const written = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string);
    expect(written.version).toBe(1);
    expect(written.profiles["manifest:default"]).toEqual({
      type: "api_key",
      provider: "manifest",
      key: apiKey,
    });
  });

  it("preserves existing version in auth-profiles.json", () => {
    const logger = makeLogger();

    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue([
      { name: "agent1", isDirectory: () => true },
    ] as any);
    mockLoadJsonFile.mockReturnValue({ version: 2, profiles: {} });

    injectAuthProfile(apiKey, logger);

    const written = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string);
    expect(written.version).toBe(2);
  });

  it("skips agents that already have the same key", () => {
    const logger = makeLogger();

    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue([
      { name: "agent1", isDirectory: () => true },
    ] as any);
    mockLoadJsonFile.mockReturnValue({
      version: 1,
      profiles: {
        "manifest:default": {
          type: "api_key",
          provider: "manifest",
          key: apiKey,
        },
      },
    });

    injectAuthProfile(apiKey, logger);

    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  it("updates profile when key is different", () => {
    const logger = makeLogger();

    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue([
      { name: "agent1", isDirectory: () => true },
    ] as any);
    mockLoadJsonFile.mockReturnValue({
      version: 1,
      profiles: {
        "manifest:default": {
          type: "api_key",
          provider: "manifest",
          key: "mnfst_old_key",
        },
      },
    });

    injectAuthProfile(apiKey, logger);

    expect(mockWriteFileSync).toHaveBeenCalled();
    const written = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string);
    expect(written.profiles["manifest:default"].key).toBe(apiKey);
  });

  it("skips agent dir when agent subdir does not exist", () => {
    const logger = makeLogger();

    mockExistsSync.mockImplementation((p) => {
      const path = String(p);
      if (path === agentsDir) return true;
      // dirname(profilePath) = agentsDir/agent1/agent => does not exist
      return false;
    });

    mockReaddirSync.mockReturnValue([
      { name: "agent1", isDirectory: () => true },
    ] as any);

    injectAuthProfile(apiKey, logger);

    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  it("handles errors gracefully and logs debug", () => {
    const logger = makeLogger();

    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockImplementation(() => {
      throw new Error("permission denied");
    });

    injectAuthProfile(apiKey, logger);

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining("Auth profile injection error"),
    );
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining("permission denied"),
    );
  });

  it("logs stringified error when error is not an Error instance", () => {
    const logger = makeLogger();

    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockImplementation(() => {
      throw "string error";
    });

    injectAuthProfile(apiKey, logger);

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining("string error"),
    );
  });
});

// ---------------------------------------------------------------------------
// checkExistingServer
// ---------------------------------------------------------------------------
describe("checkExistingServer", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns true when server responds with ok status", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true });

    const result = await checkExistingServer("127.0.0.1", 2099);

    expect(result).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:2099/api/v1/health",
      { signal: expect.any(AbortSignal) },
    );
  });

  it("returns false when server responds with non-ok status", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false });

    const result = await checkExistingServer("127.0.0.1", 2099);

    expect(result).toBe(false);
  });

  it("returns false when fetch throws (connection refused)", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("ECONNREFUSED"));

    const result = await checkExistingServer("127.0.0.1", 2099);

    expect(result).toBe(false);
  });

  it("returns false when fetch throws (timeout)", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("AbortError"));

    const result = await checkExistingServer("localhost", 3000);

    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// registerLocalMode
// ---------------------------------------------------------------------------
describe("registerLocalMode", () => {
  const host = "127.0.0.1";
  const port = 2099;
  const originalFetch = global.fetch;

  beforeEach(() => {
    // For loadOrGenerateApiKey — config dir exists, config file has a key
    mockExistsSync.mockImplementation((p) => {
      const path = String(p);
      if (path === CONFIG_DIR) return true;
      if (path === CONFIG_FILE) return true;
      if (path === OPENCLAW_DIR) return true;
      return false;
    });

    mockLoadJsonFile.mockImplementation((p) => {
      if (String(p) === CONFIG_FILE) {
        return { apiKey: "mnfst_test_key_abc123" };
      }
      return {};
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("generates API key and injects config", () => {
    const logger = makeLogger();
    const api = { config: {}, registerService: jest.fn() };

    registerLocalMode(api, port, host, logger);

    expect(logger.debug).toHaveBeenCalledWith(
      "[manifest] Starting embedded server...",
    );
    expect(logger.info).toHaveBeenCalledWith(
      `[manifest] Dashboard -> http://${host}:${port}`,
    );
    expect(api.registerService).toHaveBeenCalledWith({
      id: "manifest",
      start: expect.any(Function),
    });
  });

  describe("service start callback", () => {
    let startCallback: () => Promise<void>;
    let logger: ReturnType<typeof makeLogger>;

    beforeEach(() => {
      logger = makeLogger();
      const api = { config: {}, registerService: jest.fn() };

      registerLocalMode(api, port, host, logger);

      startCallback = api.registerService.mock.calls[0][0].start;
    });

    it("reuses existing server when health check passes", async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: true });

      await startCallback();

      expect(logger.info).toHaveBeenCalledWith(
        `[manifest] Reusing existing server at http://${host}:${port}`,
      );
      expect(mockServerStart).not.toHaveBeenCalled();
    });

    it("starts server when no existing server is running", async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error("ECONNREFUSED"));

      await startCallback();

      expect(mockServerStart).toHaveBeenCalledWith({
        port,
        host,
        dbPath: `${CONFIG_DIR}/manifest.db`,
        quiet: true,
      });
      expect(logger.info).toHaveBeenCalledWith(
        `[manifest] Server running on http://${host}:${port}`,
      );
      expect(logger.info).toHaveBeenCalledWith(
        `[manifest]   DB: ${CONFIG_DIR}/manifest.db`,
      );
    });

    it("reuses server on EADDRINUSE when health check passes", async () => {
      global.fetch = jest
        .fn()
        .mockRejectedValueOnce(new Error("ECONNREFUSED"))
        .mockResolvedValueOnce({ ok: true });

      mockServerStart.mockRejectedValue(
        new Error("listen EADDRINUSE: address already in use :::2099"),
      );

      await startCallback();

      expect(logger.info).toHaveBeenCalledWith(
        `[manifest] Reusing existing server at http://${host}:${port}`,
      );
    });

    it("logs port-in-use error on EADDRINUSE when health check fails", async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error("ECONNREFUSED"));

      mockServerStart.mockRejectedValue(
        new Error("listen EADDRINUSE: address already in use :::2099"),
      );

      await startCallback();

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining(`Port ${port} is already in use`),
      );
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining(`${port + 1}`),
      );
    });

    it("logs generic error for non-EADDRINUSE server start failures", async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error("ECONNREFUSED"));

      mockServerStart.mockRejectedValue(new Error("Database corruption"));

      await startCallback();

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to start local server"),
      );
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("Database corruption"),
      );
    });

    it("handles non-Error throws during server start", async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error("ECONNREFUSED"));

      mockServerStart.mockRejectedValue("unknown failure");

      await startCallback();

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("unknown failure"),
      );
    });

    it("handles 'address already in use' variant of EADDRINUSE", async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error("ECONNREFUSED"));

      mockServerStart.mockRejectedValue(
        new Error("address already in use 127.0.0.1:2099"),
      );

      await startCallback();

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining(`Port ${port} is already in use`),
      );
    });
  });
});

// ---------------------------------------------------------------------------
// registerLocalMode — server module load failures
// These tests use jest.resetModules() and must run in isolation.
// ---------------------------------------------------------------------------
describe("registerLocalMode server module load failures", () => {
  const host = "127.0.0.1";
  const port = 2099;

  function doMockDeps(serverFactory: () => unknown) {
    jest.resetModules();
    jest.doMock("fs", () => ({
      existsSync: mockExistsSync,
      writeFileSync: mockWriteFileSync,
      mkdirSync: mockMkdirSync,
      readdirSync: mockReaddirSync,
      renameSync: mockRenameSync,
    }));
    jest.doMock("os", () => ({ homedir: () => "/mock-home" }));
    jest.doMock("crypto", () => ({
      randomBytes: jest.fn(() => ({
        toString: () => "aabbccdd11223344aabbccdd11223344aabbccdd11223344",
      })),
    }));
    jest.doMock("../src/json-file", () => ({
      loadJsonFile: mockLoadJsonFile,
    }));
    jest.doMock("../src/server", serverFactory);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockExistsSync.mockImplementation((p) => {
      const path = String(p);
      if (path === CONFIG_DIR) return true;
      if (path === CONFIG_FILE) return true;
      if (path === OPENCLAW_DIR) return true;
      return false;
    });
    mockLoadJsonFile.mockImplementation((p) => {
      if (String(p) === CONFIG_FILE) {
        return { apiKey: "mnfst_test_key_abc123" };
      }
      return {};
    });
  });

  afterEach(() => {
    jest.resetModules();
  });

  it("logs error and returns when server module fails to load", () => {
    const logger = makeLogger();
    const api = { config: {}, registerService: jest.fn() };

    doMockDeps(() => {
      throw new Error("Cannot find module");
    });

    const { registerLocalMode: freshRegister } = require("../src/local-mode");
    freshRegister(api, port, host, logger);

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("Failed to load embedded server"),
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("Cannot find module"),
    );
    expect(api.registerService).not.toHaveBeenCalled();
  });

  it("logs stringified value when server module throws non-Error", () => {
    const logger = makeLogger();
    const api = { config: {}, registerService: jest.fn() };

    doMockDeps(() => {
      throw "string load error";
    });

    const { registerLocalMode: freshRegister } = require("../src/local-mode");
    freshRegister(api, port, host, logger);

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("string load error"),
    );
    expect(api.registerService).not.toHaveBeenCalled();
  });
});
