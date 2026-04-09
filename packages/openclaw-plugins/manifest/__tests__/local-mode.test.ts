const mockServerStart = jest.fn();

jest.mock("fs", () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
}));

jest.mock("os", () => ({
  homedir: () => "/mock-home",
}));

jest.mock("../src/server", () => ({
  start: mockServerStart,
  version: "1.0.0",
}));

import { existsSync, mkdirSync } from "fs";
import { checkExistingServer, registerLocalMode } from "../src/local-mode";

const mockExistsSync = existsSync as jest.MockedFunction<typeof existsSync>;
const mockMkdirSync = mkdirSync as jest.MockedFunction<typeof mkdirSync>;

function makeLogger() {
  return {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockExistsSync.mockReturnValue(false);
});

describe("checkExistingServer", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns true when server responds healthy", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: "healthy" }),
    });

    const result = await checkExistingServer("127.0.0.1", 2099);
    expect(result).toBe(true);
  });

  it("returns false when server responds not ok", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
    });

    const result = await checkExistingServer("127.0.0.1", 2099);
    expect(result).toBe(false);
  });

  it("returns false when server responds with non-healthy status", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: "unhealthy" }),
    });

    const result = await checkExistingServer("127.0.0.1", 2099);
    expect(result).toBe(false);
  });

  it("returns false on network error", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("ECONNREFUSED"));

    const result = await checkExistingServer("127.0.0.1", 2099);
    expect(result).toBe(false);
  });

  it("returns false when response body is null", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(null),
    });

    const result = await checkExistingServer("127.0.0.1", 2099);
    expect(result).toBe(false);
  });
});

describe("registerLocalMode", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("creates config dir if it does not exist", () => {
    const logger = makeLogger();
    const api = { registerService: jest.fn() };
    mockExistsSync.mockReturnValue(false);

    registerLocalMode(api, 2099, "127.0.0.1", logger);

    expect(mockMkdirSync).toHaveBeenCalledWith(
      expect.stringContaining("manifest"),
      expect.objectContaining({ recursive: true }),
    );
  });

  it("registers service with api", () => {
    const logger = makeLogger();
    const api = { registerService: jest.fn() };

    registerLocalMode(api, 2099, "127.0.0.1", logger);

    expect(api.registerService).toHaveBeenCalledWith(
      expect.objectContaining({ id: "manifest" }),
    );
  });

  it("does not touch api.config", () => {
    const logger = makeLogger();
    const api = { registerService: jest.fn(), config: { models: {} } };

    registerLocalMode(api, 2099, "127.0.0.1", logger);

    // Plugin should not inject provider config into api.config
    expect(api.config.models).toEqual({});
  });

  describe("service start callback", () => {
    it("reuses existing server when health check passes", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: "healthy" }),
      });

      const logger = makeLogger();
      const api = { registerService: jest.fn() };

      registerLocalMode(api, 2099, "127.0.0.1", logger);

      const serviceCall = api.registerService.mock.calls[0][0];
      await serviceCall.start();

      expect(mockServerStart).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining("Dashboard: http://127.0.0.1:2099"),
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining("Reusing existing server"),
      );
    });

    it("starts server and logs dashboard URL on success", async () => {
      let callCount = 0;
      global.fetch = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) return Promise.reject(new Error("ECONNREFUSED"));
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ status: "healthy" }),
        });
      });

      const logger = makeLogger();
      const api = { registerService: jest.fn() };

      registerLocalMode(api, 2099, "127.0.0.1", logger);

      const serviceCall = api.registerService.mock.calls[0][0];
      await serviceCall.start();

      expect(mockServerStart).toHaveBeenCalledWith(
        expect.objectContaining({ port: 2099, host: "127.0.0.1" }),
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining("Dashboard: http://127.0.0.1:2099"),
      );
    });

    it("includes custom host and port in dashboard banner", async () => {
      let callCount = 0;
      global.fetch = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) return Promise.reject(new Error("ECONNREFUSED"));
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ status: "healthy" }),
        });
      });

      const logger = makeLogger();
      const api = { registerService: jest.fn() };

      registerLocalMode(api, 3099, "0.0.0.0", logger);

      const serviceCall = api.registerService.mock.calls[0][0];
      await serviceCall.start();

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining("http://0.0.0.0:3099"),
      );
    });

    it("logs warning when server starts but health check fails", async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error("ECONNREFUSED"));

      const logger = makeLogger();
      const api = { registerService: jest.fn() };

      registerLocalMode(api, 2099, "127.0.0.1", logger);

      const serviceCall = api.registerService.mock.calls[0][0];
      await serviceCall.start();

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("health check failed"),
      );
    });

    it("uses logger.info as fallback when logger.warn is undefined", async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error("ECONNREFUSED"));

      const logger = {
        info: jest.fn(),
        debug: jest.fn(),
        error: jest.fn(),
        warn: undefined,
      };
      const api = { registerService: jest.fn() };

      registerLocalMode(api, 2099, "127.0.0.1", logger as any);

      const serviceCall = api.registerService.mock.calls[0][0];
      await serviceCall.start();

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining("health check failed"),
      );
    });

    it("handles EADDRINUSE with existing manifest server", async () => {
      mockServerStart.mockRejectedValue(new Error("listen EADDRINUSE: address already in use"));

      let callCount = 0;
      global.fetch = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) return Promise.reject(new Error("ECONNREFUSED"));
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ status: "healthy" }),
        });
      });

      const logger = makeLogger();
      const api = { registerService: jest.fn() };

      registerLocalMode(api, 2099, "127.0.0.1", logger);

      const serviceCall = api.registerService.mock.calls[0][0];
      await serviceCall.start();

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining("Dashboard: http://127.0.0.1:2099"),
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining("Reusing existing server"),
      );
    });

    it("handles EADDRINUSE with non-manifest process", async () => {
      mockServerStart.mockRejectedValue(new Error("listen EADDRINUSE: address already in use"));
      global.fetch = jest.fn().mockRejectedValue(new Error("ECONNREFUSED"));

      const logger = makeLogger();
      const api = { registerService: jest.fn() };

      registerLocalMode(api, 2099, "127.0.0.1", logger);

      const serviceCall = api.registerService.mock.calls[0][0];
      await serviceCall.start();

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("already in use by another process"),
      );
    });

    it("handles generic server start error", async () => {
      mockServerStart.mockRejectedValue(new Error("ENOMEM"));
      global.fetch = jest.fn().mockRejectedValue(new Error("ECONNREFUSED"));

      const logger = makeLogger();
      const api = { registerService: jest.fn() };

      registerLocalMode(api, 2099, "127.0.0.1", logger);

      const serviceCall = api.registerService.mock.calls[0][0];
      await serviceCall.start();

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to start local server"),
      );
    });
  });
});

describe("registerLocalMode server module load failures", () => {
  it("logs error when server module fails to load", () => {
    jest.resetModules();

    jest.mock("fs", () => ({
      existsSync: jest.fn().mockReturnValue(false),
      mkdirSync: jest.fn(),
    }));
    jest.mock("os", () => ({ homedir: () => "/mock-home" }));
    jest.mock("../src/server", () => {
      throw new Error("Cannot find module");
    });

    const { registerLocalMode: freshRegister } = require("../src/local-mode");
    const logger = makeLogger();
    const api = { registerService: jest.fn() };

    freshRegister(api, 2099, "127.0.0.1", logger);

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("Failed to load embedded server"),
    );
    expect(api.registerService).not.toHaveBeenCalled();
  });

  it("logs non-Error thrown value as string", () => {
    jest.resetModules();

    jest.mock("fs", () => ({
      existsSync: jest.fn().mockReturnValue(false),
      mkdirSync: jest.fn(),
    }));
    jest.mock("os", () => ({ homedir: () => "/mock-home" }));
    jest.mock("../src/server", () => {
      throw "string error";
    });

    const { registerLocalMode: freshRegister } = require("../src/local-mode");
    const logger = makeLogger();
    const api = { registerService: jest.fn() };

    freshRegister(api, 2099, "127.0.0.1", logger);

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("string error"),
    );
  });
});
