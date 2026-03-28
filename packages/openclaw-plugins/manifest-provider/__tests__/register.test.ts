jest.mock("../src/config", () => ({
  parseConfig: jest.fn(),
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

import { parseConfig, validateConfig } from "../src/config";
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

describe("register — devMode path", () => {
  const devConfig = {
    devMode: true,
    apiKey: "",
    endpoint: "http://localhost:38238",
    port: 2099,
    host: "127.0.0.1",
  };

  it("calls injectProviderConfig and injectAuthProfile with dev-no-auth", () => {
    (parseConfig as jest.Mock).mockReturnValue(devConfig);
    (validateConfig as jest.Mock).mockReturnValue(null);

    const api = makeApi();
    plugin.register(api);

    expect(injectProviderConfig).toHaveBeenCalledWith(
      api, "http://localhost:38238/v1", "dev-no-auth", api.logger,
    );
    expect(injectAuthProfile).toHaveBeenCalledWith("dev-no-auth", api.logger);
  });

  it("registers provider with auth onboarding", () => {
    (parseConfig as jest.Mock).mockReturnValue(devConfig);
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
    (parseConfig as jest.Mock).mockReturnValue(devConfig);
    (validateConfig as jest.Mock).mockReturnValue(null);

    const api = makeApi();
    plugin.register(api);

    expect(registerTools).toHaveBeenCalledWith(api, devConfig, api.logger);
  });

  it("registers a manifest-routing service", () => {
    (parseConfig as jest.Mock).mockReturnValue(devConfig);
    (validateConfig as jest.Mock).mockReturnValue(null);

    const api = makeApi();
    plugin.register(api);

    expect(api.registerService).toHaveBeenCalledWith(
      expect.objectContaining({ id: "manifest-routing" }),
    );
  });

  it("logs dashboard URL", () => {
    (parseConfig as jest.Mock).mockReturnValue(devConfig);
    (validateConfig as jest.Mock).mockReturnValue(null);

    const api = makeApi();
    plugin.register(api);

    expect(api.logger.info).toHaveBeenCalledWith(
      expect.stringContaining("http://localhost:38238"),
    );
  });

  it("derives port 443 for https endpoints without explicit port", () => {
    const httpsConfig = { ...devConfig, endpoint: "https://dev.example.com" };
    (parseConfig as jest.Mock).mockReturnValue(httpsConfig);
    (validateConfig as jest.Mock).mockReturnValue(null);

    const api = makeApi();
    plugin.register(api);

    expect(injectProviderConfig).toHaveBeenCalledWith(
      api, "https://dev.example.com/v1", "dev-no-auth", api.logger,
    );
  });

  it("service start invokes verifyConnection", async () => {
    (parseConfig as jest.Mock).mockReturnValue(devConfig);
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
    (parseConfig as jest.Mock).mockReturnValue(devConfig);
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
    (parseConfig as jest.Mock).mockReturnValue(devConfig);
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
    (parseConfig as jest.Mock).mockReturnValue(badDevConfig);
    (validateConfig as jest.Mock).mockReturnValue("Invalid endpoint URL");

    const api = makeApi();
    plugin.register(api);

    expect(api.logger.error).toHaveBeenCalledWith(
      expect.stringContaining("Invalid endpoint URL"),
    );
  });
});

describe("register — cloud path", () => {
  const cloudConfig = {
    devMode: false,
    apiKey: "mnfst_abc",
    endpoint: "https://app.manifest.build",
    port: 2099,
    host: "127.0.0.1",
  };

  it("initializes routing, tools, and command", () => {
    (parseConfig as jest.Mock).mockReturnValue(cloudConfig);
    (validateConfig as jest.Mock).mockReturnValue(null);

    const api = makeApi();
    plugin.register(api);

    expect(api.registerProvider).toHaveBeenCalled();
    expect(registerTools).toHaveBeenCalledWith(api, cloudConfig, api.logger);
    expect(registerCommand).toHaveBeenCalledWith(api, cloudConfig, api.logger);
  });

  it("calls injectProviderConfig and injectAuthProfile", () => {
    (parseConfig as jest.Mock).mockReturnValue(cloudConfig);
    (validateConfig as jest.Mock).mockReturnValue(null);

    const api = makeApi();
    plugin.register(api);

    expect(injectProviderConfig).toHaveBeenCalledWith(
      api, "https://app.manifest.build/v1", "mnfst_abc", api.logger,
    );
    expect(injectAuthProfile).toHaveBeenCalledWith("mnfst_abc", api.logger);
  });

  it("registers manifest-routing service", () => {
    (parseConfig as jest.Mock).mockReturnValue(cloudConfig);
    (validateConfig as jest.Mock).mockReturnValue(null);

    const api = makeApi();
    plugin.register(api);

    expect(api.registerService).toHaveBeenCalledWith(
      expect.objectContaining({ id: "manifest-routing" }),
    );
  });

  it("service start invokes verifyConnection and logs success", async () => {
    (parseConfig as jest.Mock).mockReturnValue(cloudConfig);
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

  it("service start logs warning on verify error", async () => {
    (parseConfig as jest.Mock).mockReturnValue(cloudConfig);
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

  it("service start handles verify rejection silently", async () => {
    (parseConfig as jest.Mock).mockReturnValue(cloudConfig);
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
    (parseConfig as jest.Mock).mockReturnValue(cloudConfig);
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
    (parseConfig as jest.Mock).mockReturnValue({
      devMode: false,
      apiKey: "",
      endpoint: "https://app.manifest.build",
      port: 2099,
      host: "127.0.0.1",
    });
    (validateConfig as jest.Mock).mockReturnValue("Missing apiKey");

    const api = {
      pluginConfig: {},
      config: { plugins: { entries: {} } },
      registerService: jest.fn(),
      registerTool: jest.fn(),
      registerProvider: jest.fn(),
    };

    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    plugin.register(api);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Manifest requires an API key"),
    );
    consoleSpy.mockRestore();
  });

  it("fallback logger.info delegates to console.log", () => {
    (parseConfig as jest.Mock).mockReturnValue({
      devMode: false,
      apiKey: "",
      endpoint: "https://app.manifest.build",
      port: 2099,
      host: "127.0.0.1",
    });
    (validateConfig as jest.Mock).mockReturnValue("Missing apiKey");

    const api = {
      pluginConfig: {},
      config: { plugins: { entries: {} } },
      registerService: jest.fn(),
      registerTool: jest.fn(),
      registerProvider: jest.fn(),
    };

    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    plugin.register(api);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Manifest requires an API key"),
    );
    consoleSpy.mockRestore();
  });

  it("fallback logger.error delegates to console.error", () => {
    (parseConfig as jest.Mock).mockReturnValue({
      devMode: true,
      apiKey: "",
      endpoint: "http://localhost:38238",
      port: 2099,
      host: "127.0.0.1",
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

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Invalid endpoint URL"),
    );
    consoleSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  it("fallback logger.debug is a no-op", () => {
    (parseConfig as jest.Mock).mockReturnValue({
      devMode: false,
      apiKey: "",
      endpoint: "https://app.manifest.build",
      port: 2099,
      host: "127.0.0.1",
    });
    (validateConfig as jest.Mock).mockReturnValue("Missing apiKey");

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
      devMode: true,
      apiKey: "",
      endpoint: "http://localhost:38238",
      port: 2099,
      host: "127.0.0.1",
    };
    (parseConfig as jest.Mock).mockReturnValue(devConfig);
    (validateConfig as jest.Mock).mockReturnValue(null);

    const api = makeApi();
    plugin.register(api);

    expect(registerCommand).toHaveBeenCalledWith(api, devConfig, api.logger);
  });

  it("calls registerCommand with valid config", () => {
    const cloudConfig = {
      devMode: false,
      apiKey: "mnfst_abc",
      endpoint: "https://app.manifest.build",
      port: 2099,
      host: "127.0.0.1",
    };
    (parseConfig as jest.Mock).mockReturnValue(cloudConfig);
    (validateConfig as jest.Mock).mockReturnValue(null);

    const api = makeApi();
    plugin.register(api);

    expect(registerCommand).toHaveBeenCalledWith(api, cloudConfig, api.logger);
  });
});

describe("register — missing API key", () => {
  it("logs API key required message", () => {
    (parseConfig as jest.Mock).mockReturnValue({
      devMode: false,
      apiKey: "",
      endpoint: "https://app.manifest.build",
      port: 2099,
      host: "127.0.0.1",
    });
    (validateConfig as jest.Mock).mockReturnValue("Missing apiKey");

    const api = makeApi();
    plugin.register(api);

    expect(api.logger.info).toHaveBeenCalledWith(
      expect.stringContaining("Manifest requires an API key"),
    );
  });

  it("includes setup wizard instructions in the message", () => {
    (parseConfig as jest.Mock).mockReturnValue({
      devMode: false,
      apiKey: "",
      endpoint: "https://app.manifest.build",
      port: 2099,
      host: "127.0.0.1",
    });
    (validateConfig as jest.Mock).mockReturnValue("Missing apiKey");

    const api = makeApi();
    plugin.register(api);

    expect(api.logger.info).toHaveBeenCalledWith(
      expect.stringContaining("openclaw providers setup manifest"),
    );
  });

  it("uses correct plugin name in config path", () => {
    (parseConfig as jest.Mock).mockReturnValue({
      devMode: false,
      apiKey: "",
      endpoint: "https://app.manifest.build",
      port: 2099,
      host: "127.0.0.1",
    });
    (validateConfig as jest.Mock).mockReturnValue("Missing apiKey");

    const api = makeApi();
    plugin.register(api);

    expect(api.logger.info).toHaveBeenCalledWith(
      expect.stringContaining("manifest-provider.config.apiKey"),
    );
  });
});

describe("register — registerProvider behavior", () => {
  it("skips provider registration when api.registerProvider is not a function", () => {
    (parseConfig as jest.Mock).mockReturnValue({
      devMode: false,
      apiKey: "",
      endpoint: "https://app.manifest.build",
      port: 2099,
      host: "127.0.0.1",
    });
    (validateConfig as jest.Mock).mockReturnValue("Missing apiKey");

    const api = makeApi();
    delete (api as any).registerProvider;
    plugin.register(api);

    // Should not throw — just skips provider registration
    expect(api.logger.info).toHaveBeenCalledWith(
      expect.stringContaining("Manifest requires an API key"),
    );
  });

  it("handles registerProvider error gracefully", () => {
    (parseConfig as jest.Mock).mockReturnValue({
      devMode: false,
      apiKey: "mnfst_abc",
      endpoint: "https://app.manifest.build",
      port: 2099,
      host: "127.0.0.1",
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
