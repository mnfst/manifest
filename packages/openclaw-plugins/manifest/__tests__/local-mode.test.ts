const mockServerStart = jest.fn();

jest.mock("fs", () => ({
  existsSync: jest.fn(),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
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

import { existsSync, writeFileSync, mkdirSync } from "fs";
import { loadJsonFile } from "../src/json-file";
import {
  loadOrGenerateApiKey,
  checkExistingServer,
  registerLocalMode,
} from "../src/local-mode";

const mockExistsSync = existsSync as jest.MockedFunction<typeof existsSync>;
const mockWriteFileSync = writeFileSync as jest.MockedFunction<typeof writeFileSync>;
const mockMkdirSync = mkdirSync as jest.MockedFunction<typeof mkdirSync>;
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
// checkExistingServer
// ---------------------------------------------------------------------------
describe("checkExistingServer", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns true when server responds with healthy status", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: "healthy" }),
    });

    const result = await checkExistingServer("127.0.0.1", 2099);

    expect(result).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:2099/api/v1/health",
      { signal: expect.any(AbortSignal) },
    );
  });

  it("returns false when response is ok but not a Manifest server", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ message: "some other service" }),
    });

    const result = await checkExistingServer("127.0.0.1", 2099);

    expect(result).toBe(false);
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

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("registers service with api", () => {
    const logger = makeLogger();
    const api = { registerService: jest.fn() };

    registerLocalMode(api, port, host, logger);

    expect(logger.debug).toHaveBeenCalledWith(
      "[manifest] Starting embedded server...",
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
      const api = { registerService: jest.fn() };

      registerLocalMode(api, port, host, logger);

      startCallback = api.registerService.mock.calls[0][0].start;
    });

    it("reuses existing server when health check passes", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: "healthy" }),
      });

      await startCallback();

      expect(logger.info).toHaveBeenCalledWith(
        `[manifest] Reusing existing server at http://${host}:${port}`,
      );
      expect(mockServerStart).not.toHaveBeenCalled();
    });

    it("starts server when no existing server is running", async () => {
      global.fetch = jest
        .fn()
        .mockRejectedValueOnce(new Error("ECONNREFUSED")) // checkExistingServer (pre)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ status: "healthy" }),
        }); // checkExistingServer (post-start verification)

      await startCallback();

      expect(mockServerStart).toHaveBeenCalledWith({
        port,
        host,
        dbPath: `${CONFIG_DIR}/manifest.db`,
        quiet: true,
      });
      expect(logger.info).toHaveBeenCalledWith(
        `[manifest] Dashboard -> http://${host}:${port}`,
      );
      expect(logger.info).toHaveBeenCalledWith(
        `[manifest]   DB: ${CONFIG_DIR}/manifest.db`,
      );
    });

    it("warns when server starts but verification fails", async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error("ECONNREFUSED"));

      await startCallback();

      expect(mockServerStart).toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Server started but health check failed"),
      );
    });

    it("falls back to logger.info when warn is undefined on verification failure", async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error("ECONNREFUSED"));

      // Create a logger without warn
      const noWarnLogger = {
        info: jest.fn(),
        debug: jest.fn(),
        error: jest.fn(),
      };
      const api = { registerService: jest.fn() };
      registerLocalMode(api, port, host, noWarnLogger);
      const cb = api.registerService.mock.calls[0][0].start;

      await cb();

      expect(noWarnLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("Server started but health check failed"),
      );
    });

    it("reuses server on EADDRINUSE when health check passes", async () => {
      global.fetch = jest
        .fn()
        .mockRejectedValueOnce(new Error("ECONNREFUSED")) // pre-start check
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ status: "healthy" }),
        }); // EADDRINUSE recovery check

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
    mockExistsSync.mockReturnValue(false);
    mockLoadJsonFile.mockReturnValue({});
  });

  afterEach(() => {
    jest.resetModules();
  });

  it("logs error and returns when server module fails to load", () => {
    const logger = makeLogger();
    const api = { registerService: jest.fn() };

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
    const api = { registerService: jest.fn() };

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
