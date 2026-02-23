import { ManifestConfig } from "../src/config";
import { PluginLogger } from "../src/telemetry";
import { LOCAL_DEFAULTS } from "../src/constants";

// Mock all dependencies that local-mode.ts imports at the top level
jest.mock("fs", () => ({
  readFileSync: jest.fn(() => JSON.stringify({ apiKey: "mnfst_test_key" })),
  writeFileSync: jest.fn(),
  existsSync: jest.fn(() => true),
  mkdirSync: jest.fn(),
}));

jest.mock("../src/telemetry", () => ({
  PluginLogger: jest.fn(),
  initTelemetry: jest.fn(() => ({
    tracer: {},
    meter: {},
  })),
  shutdownTelemetry: jest.fn(),
}));

jest.mock("../src/hooks", () => ({
  registerHooks: jest.fn(),
  initMetrics: jest.fn(),
}));

jest.mock("../src/tools", () => ({
  registerTools: jest.fn(),
}));

function makeLogger(): PluginLogger {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  } as unknown as PluginLogger;
}

function makeApi() {
  return {
    registerService: jest.fn(),
    registerTool: jest.fn(),
  };
}

function makeConfig(overrides: Partial<ManifestConfig> = {}): ManifestConfig {
  return {
    mode: "local",
    apiKey: "mnfst_test",
    endpoint: "http://127.0.0.1:2099/otlp",
    serviceName: "test",
    captureContent: false,
    metricsIntervalMs: 30000,
    port: 2099,
    host: "127.0.0.1",
    ...overrides,
  };
}

describe("registerLocalMode", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it("logs error with reinstall instructions when @mnfst/server is not installed", () => {
    jest.isolateModules(() => {
      jest.doMock("@mnfst/server", () => {
        throw new Error("Cannot find module '@mnfst/server'");
      });

      const { registerLocalMode } = require("../src/local-mode");
      const logger = makeLogger();
      const api = makeApi();
      registerLocalMode(api, makeConfig(), logger);

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("@mnfst/server is not installed"),
      );
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("openclaw plugins install manifest"),
      );
      expect(api.registerService).not.toHaveBeenCalled();
    });
  });

  it("registers a service when @mnfst/server loads successfully", () => {
    jest.isolateModules(() => {
      jest.doMock("@mnfst/server", () => ({
        start: jest.fn().mockResolvedValue({}),
        version: "1.0.0",
      }));

      const { registerLocalMode } = require("../src/local-mode");
      const logger = makeLogger();
      const api = makeApi();
      registerLocalMode(api, makeConfig(), logger);

      expect(api.registerService).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "manifest-local",
          start: expect.any(Function),
          stop: expect.any(Function),
        }),
      );
    });
  });

  it("logs EADDRINUSE error with port change instructions", async () => {
    const mockStart = jest.fn().mockRejectedValue(
      new Error("listen EADDRINUSE: address already in use"),
    );

    await jest.isolateModulesAsync(async () => {
      jest.doMock("@mnfst/server", () => ({ start: mockStart }));

      const { registerLocalMode } = require("../src/local-mode");
      const logger = makeLogger();
      const api = makeApi();
      registerLocalMode(api, makeConfig({ port: 2099 }), logger);

      const service = api.registerService.mock.calls[0][0];
      await service.start();

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("Port 2099 is already in use"),
      );
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("openclaw config set"),
      );
    });
  });

  it("logs native module error with build tools instructions", async () => {
    const mockStart = jest.fn().mockRejectedValue(
      new Error("Could not load better-sqlite3 bindings"),
    );

    await jest.isolateModulesAsync(async () => {
      jest.doMock("@mnfst/server", () => ({ start: mockStart }));

      const { registerLocalMode } = require("../src/local-mode");
      const logger = makeLogger();
      const api = makeApi();
      registerLocalMode(api, makeConfig(), logger);

      const service = api.registerService.mock.calls[0][0];
      await service.start();

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("SQLite native module failed to load"),
      );
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("xcode-select --install"),
      );
    });
  });

  it("logs permission error with path hints", async () => {
    const mockStart = jest.fn().mockRejectedValue(
      new Error("EACCES: permission denied, open '/home/.openclaw/manifest/manifest.db'"),
    );

    await jest.isolateModulesAsync(async () => {
      jest.doMock("@mnfst/server", () => ({ start: mockStart }));

      const { registerLocalMode } = require("../src/local-mode");
      const logger = makeLogger();
      const api = makeApi();
      registerLocalMode(api, makeConfig(), logger);

      const service = api.registerService.mock.calls[0][0];
      await service.start();

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("Permission denied"),
      );
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("Check permissions on"),
      );
    });
  });

  it("logs generic error with reinstall instructions", async () => {
    const mockStart = jest.fn().mockRejectedValue(
      new Error("Something unexpected happened"),
    );

    await jest.isolateModulesAsync(async () => {
      jest.doMock("@mnfst/server", () => ({ start: mockStart }));

      const { registerLocalMode } = require("../src/local-mode");
      const logger = makeLogger();
      const api = makeApi();
      registerLocalMode(api, makeConfig(), logger);

      const service = api.registerService.mock.calls[0][0];
      await service.start();

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to start local server"),
      );
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("Try reinstalling"),
      );
    });
  });

  it("logs success messages when server starts", async () => {
    const mockStart = jest.fn().mockResolvedValue({});

    await jest.isolateModulesAsync(async () => {
      jest.doMock("@mnfst/server", () => ({ start: mockStart }));

      const { registerLocalMode } = require("../src/local-mode");
      const logger = makeLogger();
      const api = makeApi();
      registerLocalMode(api, makeConfig({ port: 2099, host: "127.0.0.1" }), logger);

      const service = api.registerService.mock.calls[0][0];
      await service.start();

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining("Local server running on http://127.0.0.1:2099"),
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining("Dashboard: http://127.0.0.1:2099"),
      );
    });
  });

  it("overrides captureContent to true in localConfig", () => {
    jest.isolateModules(() => {
      jest.doMock("@mnfst/server", () => ({
        start: jest.fn().mockResolvedValue({}),
      }));

      const { initTelemetry } = require("../src/telemetry");
      const { registerLocalMode } = require("../src/local-mode");
      const logger = makeLogger();
      const api = makeApi();
      registerLocalMode(api, makeConfig({ captureContent: false }), logger);

      const telemetryCall = (initTelemetry as jest.Mock).mock.calls[0];
      expect(telemetryCall[0].captureContent).toBe(true);
    });
  });

  it("overrides metricsIntervalMs to LOCAL_DEFAULTS value (10s)", () => {
    jest.isolateModules(() => {
      jest.doMock("@mnfst/server", () => ({
        start: jest.fn().mockResolvedValue({}),
      }));

      const { initTelemetry } = require("../src/telemetry");
      const { registerLocalMode } = require("../src/local-mode");
      const logger = makeLogger();
      const api = makeApi();
      registerLocalMode(api, makeConfig({ metricsIntervalMs: 30_000 }), logger);

      const telemetryCall = (initTelemetry as jest.Mock).mock.calls[0];
      expect(telemetryCall[0].metricsIntervalMs).toBe(LOCAL_DEFAULTS.METRICS_INTERVAL_MS);
      expect(telemetryCall[0].metricsIntervalMs).toBe(10_000);
    });
  });

  it("sets endpoint to local server URL in localConfig", () => {
    jest.isolateModules(() => {
      jest.doMock("@mnfst/server", () => ({
        start: jest.fn().mockResolvedValue({}),
      }));

      const { initTelemetry } = require("../src/telemetry");
      const { registerLocalMode } = require("../src/local-mode");
      const logger = makeLogger();
      const api = makeApi();
      registerLocalMode(api, makeConfig({ port: 2099, host: "127.0.0.1" }), logger);

      const telemetryCall = (initTelemetry as jest.Mock).mock.calls[0];
      expect(telemetryCall[0].endpoint).toBe("http://127.0.0.1:2099/otlp");
    });
  });
});
