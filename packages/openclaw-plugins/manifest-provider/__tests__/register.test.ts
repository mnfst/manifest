jest.mock("../src/config", () => ({
  parseConfig: jest.fn(),
  parseConfigWithDeprecation: jest.fn(),
  validateConfig: jest.fn(),
}));
jest.mock("../src/tools", () => ({
  registerTools: jest.fn(),
}));
jest.mock("../src/verify", () => ({
  verifyConnection: jest.fn().mockResolvedValue({}),
}));
jest.mock("../src/provider-inject", () => ({
  injectProviderConfig: jest.fn(),
  injectAuthProfile: jest.fn(),
}));
jest.mock("../src/auth", () => ({
  runApiKeyAuth: jest.fn(),
  buildModelConfig: jest.fn().mockReturnValue({
    baseUrl: "https://app.manifest.build/v1",
    api: "openai-completions",
    models: [{ id: "auto", name: "Auto Router" }],
  }),
}));
jest.mock("../src/command", () => ({
  registerCommand: jest.fn(),
}));

import { parseConfigWithDeprecation, validateConfig } from "../src/config";
import { injectProviderConfig, injectAuthProfile } from "../src/provider-inject";
import { registerTools } from "../src/tools";
import { registerCommand } from "../src/command";
import { verifyConnection } from "../src/verify";
import { runApiKeyAuth } from "../src/auth";

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
    registerProvider: jest.fn(),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("register — mode routing", () => {
  it("logs manifest plugin message when mode is explicitly local", () => {
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

    expect(api.logger.info).toHaveBeenCalledWith(
      expect.stringContaining("manifest plugin"),
    );
  });

  it("does NOT log manifest plugin message for cloud mode", () => {
    (parseConfigWithDeprecation as jest.Mock).mockReturnValue({
      config: {
        mode: "cloud",
        devMode: false,
        apiKey: "mnfst_abc",
        endpoint: "https://app.manifest.build",
        port: 2099,
        host: "127.0.0.1",
      },
      _deprecatedDevMode: false,
    });
    (validateConfig as jest.Mock).mockReturnValue(null);

    const api = makeApi();
    plugin.register(api);

    const infoCalls = api.logger.info.mock.calls;
    const localModeCalls = infoCalls.filter(
      (call: string[]) => typeof call[0] === "string" && call[0].includes("manifest plugin"),
    );
    expect(localModeCalls).toHaveLength(0);
  });

});

describe("register — cloud mode with devMode", () => {
  const devConfig = {
    mode: "cloud" as const,
    devMode: true,
    apiKey: "",
    endpoint: "http://localhost:38238",
    port: 2099,
    host: "127.0.0.1",
  };

  it("does NOT log manifest plugin message", () => {
    (parseConfigWithDeprecation as jest.Mock).mockReturnValue({
      config: devConfig,
      _deprecatedDevMode: false,
    });
    (validateConfig as jest.Mock).mockReturnValue(null);

    const api = makeApi();
    plugin.register(api);

    const infoCalls = api.logger.info.mock.calls;
    const localModeCalls = infoCalls.filter(
      (call: string[]) => typeof call[0] === "string" && call[0].includes("manifest plugin"),
    );
    expect(localModeCalls).toHaveLength(0);
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

  it("registers provider with auth onboarding", () => {
    (parseConfigWithDeprecation as jest.Mock).mockReturnValue({
      config: devConfig,
      _deprecatedDevMode: false,
    });
    (validateConfig as jest.Mock).mockReturnValue(null);

    const api = makeApi();
    plugin.register(api);

    expect(api.registerProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "manifest",
        label: "Manifest Router",
        auth: expect.arrayContaining([
          expect.objectContaining({ id: "api-key", kind: "api_key", run: runApiKeyAuth }),
        ]),
      }),
    );
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

  it("registers a manifest-routing service", () => {
    (parseConfigWithDeprecation as jest.Mock).mockReturnValue({
      config: devConfig,
      _deprecatedDevMode: false,
    });
    (validateConfig as jest.Mock).mockReturnValue(null);

    const api = makeApi();
    plugin.register(api);

    expect(api.registerService).toHaveBeenCalledWith(
      expect.objectContaining({ id: "manifest-routing" }),
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
    const httpsConfig = { ...devConfig, endpoint: "https://dev.example.com" };
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

    // Should not throw — .catch logs at debug level
    expect(api.logger.info).toHaveBeenCalledWith(
      expect.stringContaining("Dev mode routing active"),
    );
    expect(api.logger.debug).toHaveBeenCalledWith(
      expect.stringContaining("[manifest] Connection verify error:"),
    );
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
        endpoint: "http://localhost:38238",
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
        endpoint: "http://localhost:38238",
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
    endpoint: "https://app.manifest.build",
    port: 2099,
    host: "127.0.0.1",
  };

  it("initializes routing, tools, and command in cloud mode", () => {
    (parseConfigWithDeprecation as jest.Mock).mockReturnValue({
      config: cloudConfig,
      _deprecatedDevMode: false,
    });
    (validateConfig as jest.Mock).mockReturnValue(null);

    const api = makeApi();
    plugin.register(api);

    expect(api.registerProvider).toHaveBeenCalled();
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

  it("registers manifest-routing service in cloud mode", () => {
    (parseConfigWithDeprecation as jest.Mock).mockReturnValue({
      config: cloudConfig,
      _deprecatedDevMode: false,
    });
    (validateConfig as jest.Mock).mockReturnValue(null);

    const api = makeApi();
    plugin.register(api);

    expect(api.registerService).toHaveBeenCalledWith(
      expect.objectContaining({ id: "manifest-routing" }),
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
      expect.stringContaining("Routing active"),
    );
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
      registerProvider: jest.fn(),
    };
    // No logger property

    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    plugin.register(api);

    // Should not throw — fallback logger.info delegates to console.log
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("manifest plugin"),
    );
    consoleSpy.mockRestore();
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

    const api = {
      pluginConfig: {},
      config: { plugins: { entries: {} } },
      registerService: jest.fn(),
      registerTool: jest.fn(),
      registerProvider: jest.fn(),
    };

    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    plugin.register(api);

    // The local-mode branch calls logger.info(...) which delegates to console.log
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("manifest plugin"),
    );
    consoleSpy.mockRestore();
  });

  it("fallback logger.error delegates to console.error", () => {
    (parseConfigWithDeprecation as jest.Mock).mockReturnValue({
      config: {
        mode: "cloud",
        devMode: true,
        apiKey: "",
        endpoint: "http://localhost:38238",
        port: 2099,
        host: "127.0.0.1",
      },
      _deprecatedDevMode: false,
    });
    (validateConfig as jest.Mock).mockReturnValue("Invalid endpoint URL");

    const api = {
      pluginConfig: {},
      config: { plugins: { entries: {} } },
      registerService: jest.fn(),
      registerTool: jest.fn(),
      registerProvider: jest.fn(),
    };

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    plugin.register(api);

    // The validation error branch calls logger.error which delegates to console.error
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Invalid endpoint URL"),
    );
    consoleSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  it("fallback logger.warn delegates to console.warn", () => {
    (parseConfigWithDeprecation as jest.Mock).mockReturnValue({
      config: {
        mode: "cloud",
        devMode: true,
        apiKey: "",
        endpoint: "http://localhost:38238",
        port: 2099,
        host: "127.0.0.1",
      },
      _deprecatedDevMode: true,
    });
    (validateConfig as jest.Mock).mockReturnValue(null);

    const api = {
      pluginConfig: {},
      config: { plugins: { entries: {} } },
      registerService: jest.fn(),
      registerTool: jest.fn(),
      registerProvider: jest.fn(),
    };

    const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    plugin.register(api);

    // The deprecation branch calls logger.warn which delegates to console.warn
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("deprecated"),
    );
    consoleSpy.mockRestore();
    consoleLogSpy.mockRestore();
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

    const api = {
      pluginConfig: {},
      config: { plugins: { entries: {} } },
      registerService: jest.fn(),
      registerTool: jest.fn(),
      registerProvider: jest.fn(),
    };

    const consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    // Should not throw — debug is a no-op on the fallback logger
    plugin.register(api);
    consoleLogSpy.mockRestore();
  });
});

describe("register — registerCommand wiring", () => {
  it("calls registerCommand in devMode", () => {
    const devConfig = {
      mode: "cloud" as const,
      devMode: true,
      apiKey: "",
      endpoint: "http://localhost:38238",
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
      endpoint: "https://app.manifest.build",
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
        endpoint: "https://app.manifest.build",
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

  it("includes setup wizard instructions in the message", () => {
    (parseConfigWithDeprecation as jest.Mock).mockReturnValue({
      config: {
        mode: "cloud",
        devMode: false,
        apiKey: "",
        endpoint: "https://app.manifest.build",
        port: 2099,
        host: "127.0.0.1",
      },
      _deprecatedDevMode: false,
    });
    (validateConfig as jest.Mock).mockReturnValue("Missing apiKey");

    const api = makeApi();
    plugin.register(api);

    expect(api.logger.info).toHaveBeenCalledWith(
      expect.stringContaining("openclaw providers setup manifest"),
    );
  });
});

describe("register — registerProvider behavior", () => {
  it("skips provider registration when api.registerProvider is not a function", () => {
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
    delete (api as any).registerProvider;
    plugin.register(api);

    // Should not throw — just skips provider registration and logs manifest message
    expect(api.logger.info).toHaveBeenCalledWith(
      expect.stringContaining("manifest plugin"),
    );
  });

  it("handles registerProvider error gracefully", () => {
    (parseConfigWithDeprecation as jest.Mock).mockReturnValue({
      config: {
        mode: "cloud",
        devMode: false,
        apiKey: "mnfst_abc",
        endpoint: "https://app.manifest.build",
        port: 2099,
        host: "127.0.0.1",
      },
      _deprecatedDevMode: false,
    });
    (validateConfig as jest.Mock).mockReturnValue(null);

    const api = makeApi();
    api.registerProvider.mockImplementation(() => {
      throw new Error("provider registration failed");
    });
    plugin.register(api);

    // Should not throw — error is caught and logged via debug
    expect(api.logger.debug).toHaveBeenCalledWith(
      expect.stringContaining("registerProvider failed"),
    );
  });
});
