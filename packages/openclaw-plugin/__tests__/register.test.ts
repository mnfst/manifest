jest.mock("../src/config", () => ({
  parseConfig: jest.fn(),
  parseConfigWithDeprecation: jest.fn(),
  validateConfig: jest.fn(),
}));
jest.mock("../src/telemetry", () => ({
  initTelemetry: jest.fn(() => ({ tracer: {}, meter: {} })),
  shutdownTelemetry: jest.fn(),
}));
jest.mock("../src/hooks", () => ({
  registerHooks: jest.fn(),
  initMetrics: jest.fn(),
}));
jest.mock("../src/tools", () => ({
  registerTools: jest.fn(),
}));
jest.mock("../src/verify", () => ({
  verifyConnection: jest.fn().mockResolvedValue({}),
}));
jest.mock("../src/local-mode", () => ({
  registerLocalMode: jest.fn(),
  injectProviderConfig: jest.fn(),
  injectAuthProfile: jest.fn(),
}));
jest.mock("../src/routing", () => ({
  registerRouting: jest.fn(),
}));
jest.mock("../src/command", () => ({
  registerCommand: jest.fn(),
}));

import { parseConfigWithDeprecation, validateConfig } from "../src/config";
import { registerLocalMode, injectProviderConfig, injectAuthProfile } from "../src/local-mode";
import { initTelemetry, shutdownTelemetry } from "../src/telemetry";
import { registerHooks, initMetrics } from "../src/hooks";
import { registerRouting } from "../src/routing";
import { registerTools } from "../src/tools";
import { registerCommand } from "../src/command";
import { verifyConnection } from "../src/verify";

const plugin = require("../src/index");

function makeApi(pluginConfig?: unknown) {
  return {
    pluginConfig,
    config: { plugins: { entries: {} } },
    logger: {
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    },
    registerService: jest.fn(),
    registerTool: jest.fn(),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("register — mode routing", () => {
  it("delegates to registerLocalMode when mode is explicitly local", () => {
    (parseConfigWithDeprecation as jest.Mock).mockReturnValue({
      config: {
        mode: "local",
        devMode: false,
        apiKey: "",
        endpoint: "",
        port: 2099,
        host: "127.0.0.1",
      },
      _deprecatedDevMode: false,
    });

    const api = makeApi();
    plugin.register(api);

    expect(registerLocalMode).toHaveBeenCalled();
  });

  it("does NOT delegate to registerLocalMode for cloud mode", () => {
    (parseConfigWithDeprecation as jest.Mock).mockReturnValue({
      config: {
        mode: "cloud",
        devMode: false,
        apiKey: "mnfst_abc",
        endpoint: "https://app.manifest.build/otlp",
        port: 2099,
        host: "127.0.0.1",
      },
      _deprecatedDevMode: false,
    });
    (validateConfig as jest.Mock).mockReturnValue(null);

    const api = makeApi();
    plugin.register(api);

    expect(registerLocalMode).not.toHaveBeenCalled();
  });

});

describe("register — cloud mode with devMode", () => {
  const devConfig = {
    mode: "cloud" as const,
    devMode: true,
    apiKey: "",
    endpoint: "http://localhost:38238/otlp",
    port: 2099,
    host: "127.0.0.1",
  };

  it("does NOT delegate to registerLocalMode", () => {
    (parseConfigWithDeprecation as jest.Mock).mockReturnValue({
      config: devConfig,
      _deprecatedDevMode: false,
    });
    (validateConfig as jest.Mock).mockReturnValue(null);

    const api = makeApi();
    plugin.register(api);

    expect(registerLocalMode).not.toHaveBeenCalled();
  });

  it("calls injectProviderConfig and injectAuthProfile with dev-no-auth", () => {
    (parseConfigWithDeprecation as jest.Mock).mockReturnValue({
      config: devConfig,
      _deprecatedDevMode: false,
    });
    (validateConfig as jest.Mock).mockReturnValue(null);

    const api = makeApi();
    plugin.register(api);

    expect(injectProviderConfig).toHaveBeenCalledWith(
      api, "http://localhost:38238/v1", "dev-no-auth", api.logger,
    );
    expect(injectAuthProfile).toHaveBeenCalledWith("dev-no-auth", api.logger);
  });

  it("initializes telemetry, hooks, and routing", () => {
    (parseConfigWithDeprecation as jest.Mock).mockReturnValue({
      config: devConfig,
      _deprecatedDevMode: false,
    });
    (validateConfig as jest.Mock).mockReturnValue(null);

    const api = makeApi();
    plugin.register(api);

    expect(initTelemetry).toHaveBeenCalledWith(devConfig, api.logger);
    expect(initMetrics).toHaveBeenCalled();
    expect(registerHooks).toHaveBeenCalledWith(api, expect.anything(), devConfig, api.logger);
    expect(registerRouting).toHaveBeenCalledWith(api, devConfig, api.logger);
  });

  it("registers tools when registerTool is available", () => {
    (parseConfigWithDeprecation as jest.Mock).mockReturnValue({
      config: devConfig,
      _deprecatedDevMode: false,
    });
    (validateConfig as jest.Mock).mockReturnValue(null);

    const api = makeApi();
    plugin.register(api);

    expect(registerTools).toHaveBeenCalledWith(api, devConfig, api.logger);
  });

  it("registers a manifest-dev service", () => {
    (parseConfigWithDeprecation as jest.Mock).mockReturnValue({
      config: devConfig,
      _deprecatedDevMode: false,
    });
    (validateConfig as jest.Mock).mockReturnValue(null);

    const api = makeApi();
    plugin.register(api);

    expect(api.registerService).toHaveBeenCalledWith(
      expect.objectContaining({ id: "manifest-dev" }),
    );
  });

  it("logs dashboard URL", () => {
    (parseConfigWithDeprecation as jest.Mock).mockReturnValue({
      config: devConfig,
      _deprecatedDevMode: false,
    });
    (validateConfig as jest.Mock).mockReturnValue(null);

    const api = makeApi();
    plugin.register(api);

    expect(api.logger.info).toHaveBeenCalledWith(
      expect.stringContaining("http://localhost:38238"),
    );
  });

  it("derives port 443 for https endpoints without explicit port", () => {
    const httpsConfig = { ...devConfig, endpoint: "https://dev.example.com/otlp" };
    (parseConfigWithDeprecation as jest.Mock).mockReturnValue({
      config: httpsConfig,
      _deprecatedDevMode: false,
    });
    (validateConfig as jest.Mock).mockReturnValue(null);

    const api = makeApi();
    plugin.register(api);

    expect(injectProviderConfig).toHaveBeenCalledWith(
      api, "https://dev.example.com/v1", "dev-no-auth", api.logger,
    );
  });

  it("service start invokes verifyConnection", async () => {
    (parseConfigWithDeprecation as jest.Mock).mockReturnValue({
      config: devConfig,
      _deprecatedDevMode: false,
    });
    (validateConfig as jest.Mock).mockReturnValue(null);
    (verifyConnection as jest.Mock).mockResolvedValue({ error: null, agentName: "test-agent" });

    const api = makeApi();
    plugin.register(api);

    const serviceCall = api.registerService.mock.calls[0][0];
    serviceCall.start();
    await new Promise((r) => setTimeout(r, 0));

    expect(verifyConnection).toHaveBeenCalledWith(devConfig);
    expect(api.logger.info).toHaveBeenCalledWith(
      expect.stringContaining("Connection verified"),
    );
  });

  it("service start logs warning on verify error", async () => {
    (parseConfigWithDeprecation as jest.Mock).mockReturnValue({
      config: devConfig,
      _deprecatedDevMode: false,
    });
    (validateConfig as jest.Mock).mockReturnValue(null);
    (verifyConnection as jest.Mock).mockResolvedValue({
      error: "Cannot reach endpoint",
      agentName: null,
    });

    const api = makeApi();
    plugin.register(api);

    const serviceCall = api.registerService.mock.calls[0][0];
    serviceCall.start();
    await new Promise((r) => setTimeout(r, 0));

    expect(api.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("Connection check failed"),
    );
  });

  it("service start handles verify rejection", async () => {
    (parseConfigWithDeprecation as jest.Mock).mockReturnValue({
      config: devConfig,
      _deprecatedDevMode: false,
    });
    (validateConfig as jest.Mock).mockReturnValue(null);
    (verifyConnection as jest.Mock).mockRejectedValue(new Error("boom"));

    const api = makeApi();
    plugin.register(api);

    const serviceCall = api.registerService.mock.calls[0][0];
    serviceCall.start();
    await new Promise((r) => setTimeout(r, 0));

    // Should not throw — .catch(() => {}) swallows the error
    expect(api.logger.info).toHaveBeenCalledWith(
      expect.stringContaining("Dev mode pipeline active"),
    );
  });

  it("service stop shuts down telemetry", async () => {
    (parseConfigWithDeprecation as jest.Mock).mockReturnValue({
      config: devConfig,
      _deprecatedDevMode: false,
    });
    (validateConfig as jest.Mock).mockReturnValue(null);

    const api = makeApi();
    plugin.register(api);

    const serviceCall = api.registerService.mock.calls[0][0];
    await serviceCall.stop();

    expect(shutdownTelemetry).toHaveBeenCalledWith(api.logger);
  });

  it("logs error message for validation errors in devMode", () => {
    const badDevConfig = { ...devConfig, endpoint: "not-a-url" };
    (parseConfigWithDeprecation as jest.Mock).mockReturnValue({
      config: badDevConfig,
      _deprecatedDevMode: false,
    });
    (validateConfig as jest.Mock).mockReturnValue("Invalid endpoint URL");

    const api = makeApi();
    plugin.register(api);

    expect(api.logger.error).toHaveBeenCalledWith(
      expect.stringContaining("Invalid endpoint URL"),
    );
  });
});

describe("register — deprecation warning", () => {
  it("logs deprecation warning when _deprecatedDevMode is true", () => {
    (parseConfigWithDeprecation as jest.Mock).mockReturnValue({
      config: {
        mode: "cloud",
        devMode: true,
        apiKey: "",
        endpoint: "http://localhost:38238/otlp",
        port: 2099,
        host: "127.0.0.1",
      },
      _deprecatedDevMode: true,
    });
    (validateConfig as jest.Mock).mockReturnValue(null);

    const api = makeApi();
    plugin.register(api);

    expect(api.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("deprecated"),
    );
  });

  it("does not log deprecation warning when _deprecatedDevMode is false", () => {
    (parseConfigWithDeprecation as jest.Mock).mockReturnValue({
      config: {
        mode: "cloud",
        devMode: true,
        apiKey: "",
        endpoint: "http://localhost:38238/otlp",
        port: 2099,
        host: "127.0.0.1",
      },
      _deprecatedDevMode: false,
    });
    (validateConfig as jest.Mock).mockReturnValue(null);

    const api = makeApi();
    plugin.register(api);

    const warnCalls = api.logger.warn.mock.calls;
    const deprecationCalls = warnCalls.filter(
      (call: string[]) => typeof call[0] === "string" && call[0].includes("deprecated"),
    );
    expect(deprecationCalls).toHaveLength(0);
  });
});

describe("register — cloud mode full path", () => {
  const cloudConfig = {
    mode: "cloud" as const,
    devMode: false,
    apiKey: "mnfst_abc",
    endpoint: "https://app.manifest.build/otlp",
    port: 2099,
    host: "127.0.0.1",
  };

  it("initializes telemetry, hooks, routing, tools, and command in cloud mode", () => {
    (parseConfigWithDeprecation as jest.Mock).mockReturnValue({
      config: cloudConfig,
      _deprecatedDevMode: false,
    });
    (validateConfig as jest.Mock).mockReturnValue(null);

    const api = makeApi();
    plugin.register(api);

    expect(initTelemetry).toHaveBeenCalledWith(cloudConfig, api.logger);
    expect(initMetrics).toHaveBeenCalled();
    expect(registerHooks).toHaveBeenCalledWith(api, expect.anything(), cloudConfig, api.logger);
    expect(registerRouting).toHaveBeenCalledWith(api, cloudConfig, api.logger);
    expect(registerTools).toHaveBeenCalledWith(api, cloudConfig, api.logger);
    expect(registerCommand).toHaveBeenCalledWith(api, cloudConfig, api.logger);
  });

  it("calls injectProviderConfig and injectAuthProfile in cloud mode", () => {
    (parseConfigWithDeprecation as jest.Mock).mockReturnValue({
      config: cloudConfig,
      _deprecatedDevMode: false,
    });
    (validateConfig as jest.Mock).mockReturnValue(null);

    const api = makeApi();
    plugin.register(api);

    expect(injectProviderConfig).toHaveBeenCalledWith(
      api, "https://app.manifest.build/v1", "mnfst_abc", api.logger,
    );
    expect(injectAuthProfile).toHaveBeenCalledWith("mnfst_abc", api.logger);
  });

  it("registers manifest-telemetry service in cloud mode", () => {
    (parseConfigWithDeprecation as jest.Mock).mockReturnValue({
      config: cloudConfig,
      _deprecatedDevMode: false,
    });
    (validateConfig as jest.Mock).mockReturnValue(null);

    const api = makeApi();
    plugin.register(api);

    expect(api.registerService).toHaveBeenCalledWith(
      expect.objectContaining({ id: "manifest-telemetry" }),
    );
  });

  it("cloud service start invokes verifyConnection and logs success", async () => {
    (parseConfigWithDeprecation as jest.Mock).mockReturnValue({
      config: cloudConfig,
      _deprecatedDevMode: false,
    });
    (validateConfig as jest.Mock).mockReturnValue(null);
    (verifyConnection as jest.Mock).mockResolvedValue({
      error: null,
      agentName: "cloud-agent",
    });

    const api = makeApi();
    plugin.register(api);

    const serviceCall = api.registerService.mock.calls[0][0];
    serviceCall.start();
    await new Promise((r) => setTimeout(r, 0));

    expect(verifyConnection).toHaveBeenCalledWith(cloudConfig);
    expect(api.logger.info).toHaveBeenCalledWith(
      expect.stringContaining("Connection verified"),
    );
  });

  it("cloud service start logs warning on verify error", async () => {
    (parseConfigWithDeprecation as jest.Mock).mockReturnValue({
      config: cloudConfig,
      _deprecatedDevMode: false,
    });
    (validateConfig as jest.Mock).mockReturnValue(null);
    (verifyConnection as jest.Mock).mockResolvedValue({
      error: "Cannot reach endpoint",
      agentName: null,
    });

    const api = makeApi();
    plugin.register(api);

    const serviceCall = api.registerService.mock.calls[0][0];
    serviceCall.start();
    await new Promise((r) => setTimeout(r, 0));

    expect(api.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("Connection check failed"),
    );
  });

  it("cloud service start handles verify rejection silently", async () => {
    (parseConfigWithDeprecation as jest.Mock).mockReturnValue({
      config: cloudConfig,
      _deprecatedDevMode: false,
    });
    (validateConfig as jest.Mock).mockReturnValue(null);
    (verifyConnection as jest.Mock).mockRejectedValue(new Error("boom"));

    const api = makeApi();
    plugin.register(api);

    const serviceCall = api.registerService.mock.calls[0][0];
    serviceCall.start();
    await new Promise((r) => setTimeout(r, 0));

    // Should not throw
    expect(api.logger.info).toHaveBeenCalledWith(
      expect.stringContaining("Observability pipeline active"),
    );
  });

  it("cloud service stop shuts down telemetry", async () => {
    (parseConfigWithDeprecation as jest.Mock).mockReturnValue({
      config: cloudConfig,
      _deprecatedDevMode: false,
    });
    (validateConfig as jest.Mock).mockReturnValue(null);

    const api = makeApi();
    plugin.register(api);

    const serviceCall = api.registerService.mock.calls[0][0];
    await serviceCall.stop();

    expect(shutdownTelemetry).toHaveBeenCalledWith(api.logger);
  });

  it("skips registerTools when registerTool is not a function", () => {
    (parseConfigWithDeprecation as jest.Mock).mockReturnValue({
      config: cloudConfig,
      _deprecatedDevMode: false,
    });
    (validateConfig as jest.Mock).mockReturnValue(null);

    const api = makeApi();
    delete (api as any).registerTool;
    plugin.register(api);

    expect(registerTools).not.toHaveBeenCalled();
    expect(api.logger.info).toHaveBeenCalledWith(
      expect.stringContaining("Agent tools not available"),
    );
  });
});

describe("register — fallback logger", () => {
  it("uses console-based logger when api.logger is not provided", () => {
    (parseConfigWithDeprecation as jest.Mock).mockReturnValue({
      config: {
        mode: "local",
        devMode: false,
        apiKey: "",
        endpoint: "",
        port: 2099,
        host: "127.0.0.1",
      },
      _deprecatedDevMode: false,
    });

    const api = {
      pluginConfig: {},
      config: { plugins: { entries: {} } },
      registerService: jest.fn(),
      registerTool: jest.fn(),
    };
    // No logger property

    plugin.register(api);

    // Should not throw and registerLocalMode should be called
    expect(registerLocalMode).toHaveBeenCalled();
  });

  it("fallback logger.info delegates to console.log", () => {
    (parseConfigWithDeprecation as jest.Mock).mockReturnValue({
      config: {
        mode: "local",
        devMode: false,
        apiKey: "",
        endpoint: "",
        port: 2099,
        host: "127.0.0.1",
      },
      _deprecatedDevMode: false,
    });

    let capturedLogger: any;
    (registerLocalMode as jest.Mock).mockImplementation((_api, _config, logger) => {
      capturedLogger = logger;
    });

    const api = {
      pluginConfig: {},
      config: { plugins: { entries: {} } },
      registerService: jest.fn(),
      registerTool: jest.fn(),
    };

    plugin.register(api);

    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    capturedLogger.info("test info");
    expect(consoleSpy).toHaveBeenCalledWith("test info");
    consoleSpy.mockRestore();
  });

  it("fallback logger.error delegates to console.error", () => {
    (parseConfigWithDeprecation as jest.Mock).mockReturnValue({
      config: {
        mode: "local",
        devMode: false,
        apiKey: "",
        endpoint: "",
        port: 2099,
        host: "127.0.0.1",
      },
      _deprecatedDevMode: false,
    });

    let capturedLogger: any;
    (registerLocalMode as jest.Mock).mockImplementation((_api, _config, logger) => {
      capturedLogger = logger;
    });

    const api = {
      pluginConfig: {},
      config: { plugins: { entries: {} } },
      registerService: jest.fn(),
      registerTool: jest.fn(),
    };

    plugin.register(api);

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    capturedLogger.error("test error");
    expect(consoleSpy).toHaveBeenCalledWith("test error");
    consoleSpy.mockRestore();
  });

  it("fallback logger.warn delegates to console.warn", () => {
    (parseConfigWithDeprecation as jest.Mock).mockReturnValue({
      config: {
        mode: "local",
        devMode: false,
        apiKey: "",
        endpoint: "",
        port: 2099,
        host: "127.0.0.1",
      },
      _deprecatedDevMode: false,
    });

    let capturedLogger: any;
    (registerLocalMode as jest.Mock).mockImplementation((_api, _config, logger) => {
      capturedLogger = logger;
    });

    const api = {
      pluginConfig: {},
      config: { plugins: { entries: {} } },
      registerService: jest.fn(),
      registerTool: jest.fn(),
    };

    plugin.register(api);

    const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    capturedLogger.warn("test warn");
    expect(consoleSpy).toHaveBeenCalledWith("test warn");
    consoleSpy.mockRestore();
  });

  it("fallback logger.debug is a no-op", () => {
    (parseConfigWithDeprecation as jest.Mock).mockReturnValue({
      config: {
        mode: "local",
        devMode: false,
        apiKey: "",
        endpoint: "",
        port: 2099,
        host: "127.0.0.1",
      },
      _deprecatedDevMode: false,
    });

    let capturedLogger: any;
    (registerLocalMode as jest.Mock).mockImplementation((_api, _config, logger) => {
      capturedLogger = logger;
    });

    const api = {
      pluginConfig: {},
      config: { plugins: { entries: {} } },
      registerService: jest.fn(),
      registerTool: jest.fn(),
    };

    plugin.register(api);

    // Should not throw
    capturedLogger.debug("test debug");
  });
});

describe("register — diagnostics-otel conflict", () => {
  it("aborts registration when diagnostics-otel is enabled", () => {
    (parseConfigWithDeprecation as jest.Mock).mockReturnValue({
      config: {
        mode: "cloud",
        devMode: false,
        apiKey: "mnfst_abc",
        endpoint: "https://app.manifest.build/otlp",
        port: 2099,
        host: "127.0.0.1",
      },
      _deprecatedDevMode: false,
    });
    (validateConfig as jest.Mock).mockReturnValue(null);

    const api = {
      pluginConfig: {},
      config: {
        plugins: {
          entries: {
            "diagnostics-otel": { enabled: true },
          },
        },
      },
      logger: {
        info: jest.fn(),
        debug: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
      },
      registerService: jest.fn(),
      registerTool: jest.fn(),
    };

    plugin.register(api);

    expect(api.logger.error).toHaveBeenCalledWith(
      expect.stringContaining("diagnostics-otel"),
    );
    expect(initTelemetry).not.toHaveBeenCalled();
  });
});

describe("register — registerCommand wiring", () => {
  it("calls registerCommand in devMode", () => {
    const devConfig = {
      mode: "cloud" as const,
      devMode: true,
      apiKey: "",
      endpoint: "http://localhost:38238/otlp",
      port: 2099,
      host: "127.0.0.1",
    };
    (parseConfigWithDeprecation as jest.Mock).mockReturnValue({
      config: devConfig,
      _deprecatedDevMode: false,
    });
    (validateConfig as jest.Mock).mockReturnValue(null);

    const api = makeApi();
    plugin.register(api);

    expect(registerCommand).toHaveBeenCalledWith(api, devConfig, api.logger);
  });

  it("calls registerCommand in cloud mode", () => {
    const cloudConfig = {
      mode: "cloud" as const,
      devMode: false,
      apiKey: "mnfst_abc",
      endpoint: "https://app.manifest.build/otlp",
      port: 2099,
      host: "127.0.0.1",
    };
    (parseConfigWithDeprecation as jest.Mock).mockReturnValue({
      config: cloudConfig,
      _deprecatedDevMode: false,
    });
    (validateConfig as jest.Mock).mockReturnValue(null);

    const api = makeApi();
    plugin.register(api);

    expect(registerCommand).toHaveBeenCalledWith(api, cloudConfig, api.logger);
  });
});

describe("register — cloud mode missing API key", () => {
  it("logs cloud mode requires API key message", () => {
    (parseConfigWithDeprecation as jest.Mock).mockReturnValue({
      config: {
        mode: "cloud",
        devMode: false,
        apiKey: "",
        endpoint: "https://app.manifest.build/otlp",
        port: 2099,
        host: "127.0.0.1",
      },
      _deprecatedDevMode: false,
    });
    (validateConfig as jest.Mock).mockReturnValue("Missing apiKey");

    const api = makeApi();
    plugin.register(api);

    expect(api.logger.info).toHaveBeenCalledWith(
      expect.stringContaining("Cloud mode requires an API key"),
    );
  });

  it("includes tip about local mode in the message", () => {
    (parseConfigWithDeprecation as jest.Mock).mockReturnValue({
      config: {
        mode: "cloud",
        devMode: false,
        apiKey: "",
        endpoint: "https://app.manifest.build/otlp",
        port: 2099,
        host: "127.0.0.1",
      },
      _deprecatedDevMode: false,
    });
    (validateConfig as jest.Mock).mockReturnValue("Missing apiKey");

    const api = makeApi();
    plugin.register(api);

    expect(api.logger.info).toHaveBeenCalledWith(
      expect.stringContaining("Set mode to local"),
    );
  });
});
