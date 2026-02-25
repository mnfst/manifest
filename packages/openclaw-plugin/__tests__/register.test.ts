jest.mock("../src/config", () => ({
  parseConfig: jest.fn(),
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
jest.mock("../src/product-telemetry", () => ({
  trackPluginEvent: jest.fn(),
}));

import { parseConfig, validateConfig } from "../src/config";
import { registerLocalMode, injectProviderConfig, injectAuthProfile } from "../src/local-mode";
import { initTelemetry, shutdownTelemetry } from "../src/telemetry";
import { registerHooks, initMetrics } from "../src/hooks";
import { registerRouting } from "../src/routing";
import { registerTools } from "../src/tools";
import { verifyConnection } from "../src/verify";
import { trackPluginEvent } from "../src/product-telemetry";

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
  it("delegates to registerLocalMode when mode defaults to local", () => {
    (parseConfig as jest.Mock).mockReturnValue({
      mode: "local",
      apiKey: "",
      endpoint: "",
      port: 2099,
      host: "127.0.0.1",
    });

    const api = makeApi();
    plugin.register(api);

    expect(registerLocalMode).toHaveBeenCalled();
  });

  it("does NOT delegate to registerLocalMode for cloud mode", () => {
    (parseConfig as jest.Mock).mockReturnValue({
      mode: "cloud",
      apiKey: "mnfst_abc",
      endpoint: "https://app.manifest.build/otlp",
      port: 2099,
      host: "127.0.0.1",
    });
    (validateConfig as jest.Mock).mockReturnValue(null);

    const api = makeApi();
    plugin.register(api);

    expect(registerLocalMode).not.toHaveBeenCalled();
  });

  it("tracks plugin_mode_selected event with correct mode", () => {
    (parseConfig as jest.Mock).mockReturnValue({
      mode: "local",
      apiKey: "",
      endpoint: "",
      port: 2099,
      host: "127.0.0.1",
    });

    const api = makeApi();
    plugin.register(api);

    expect(trackPluginEvent).toHaveBeenCalledWith("plugin_mode_selected", {
      mode: "local",
    });
  });
});

describe("register — dev mode", () => {
  const devConfig = {
    mode: "dev" as const,
    apiKey: "",
    endpoint: "http://localhost:38238/otlp",
    port: 2099,
    host: "127.0.0.1",
  };

  it("does NOT call trackPluginEvent in dev mode", () => {
    (parseConfig as jest.Mock).mockReturnValue(devConfig);
    (validateConfig as jest.Mock).mockReturnValue(null);

    const api = makeApi();
    plugin.register(api);

    expect(trackPluginEvent).not.toHaveBeenCalled();
  });

  it("does NOT delegate to registerLocalMode", () => {
    (parseConfig as jest.Mock).mockReturnValue(devConfig);
    (validateConfig as jest.Mock).mockReturnValue(null);

    const api = makeApi();
    plugin.register(api);

    expect(registerLocalMode).not.toHaveBeenCalled();
  });

  it("calls injectProviderConfig and injectAuthProfile", () => {
    (parseConfig as jest.Mock).mockReturnValue(devConfig);
    (validateConfig as jest.Mock).mockReturnValue(null);

    const api = makeApi();
    plugin.register(api);

    expect(injectProviderConfig).toHaveBeenCalledWith(
      api, "localhost", 38238, "dev-no-auth", api.logger,
    );
    expect(injectAuthProfile).toHaveBeenCalledWith("dev-no-auth", api.logger);
  });

  it("initializes telemetry, hooks, and routing", () => {
    (parseConfig as jest.Mock).mockReturnValue(devConfig);
    (validateConfig as jest.Mock).mockReturnValue(null);

    const api = makeApi();
    plugin.register(api);

    expect(initTelemetry).toHaveBeenCalledWith(devConfig, api.logger);
    expect(initMetrics).toHaveBeenCalled();
    expect(registerHooks).toHaveBeenCalledWith(api, expect.anything(), devConfig, api.logger);
    expect(registerRouting).toHaveBeenCalledWith(api, devConfig, api.logger);
  });

  it("registers tools when registerTool is available", () => {
    (parseConfig as jest.Mock).mockReturnValue(devConfig);
    (validateConfig as jest.Mock).mockReturnValue(null);

    const api = makeApi();
    plugin.register(api);

    expect(registerTools).toHaveBeenCalledWith(api, devConfig, api.logger);
  });

  it("registers a manifest-dev service", () => {
    (parseConfig as jest.Mock).mockReturnValue(devConfig);
    (validateConfig as jest.Mock).mockReturnValue(null);

    const api = makeApi();
    plugin.register(api);

    expect(api.registerService).toHaveBeenCalledWith(
      expect.objectContaining({ id: "manifest-dev" }),
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
    const httpsConfig = { ...devConfig, endpoint: "https://dev.example.com/otlp" };
    (parseConfig as jest.Mock).mockReturnValue(httpsConfig);
    (validateConfig as jest.Mock).mockReturnValue(null);

    const api = makeApi();
    plugin.register(api);

    expect(injectProviderConfig).toHaveBeenCalledWith(
      api, "dev.example.com", 443, "dev-no-auth", api.logger,
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

    // Should not throw — .catch(() => {}) swallows the error
    expect(api.logger.info).toHaveBeenCalledWith(
      expect.stringContaining("Dev mode pipeline active"),
    );
  });

  it("service stop shuts down telemetry", async () => {
    (parseConfig as jest.Mock).mockReturnValue(devConfig);
    (validateConfig as jest.Mock).mockReturnValue(null);

    const api = makeApi();
    plugin.register(api);

    const serviceCall = api.registerService.mock.calls[0][0];
    await serviceCall.stop();

    expect(shutdownTelemetry).toHaveBeenCalledWith(api.logger);
  });

  it("logs error message for non-cloud validation errors in dev mode", () => {
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

describe("register — cloud mode missing API key", () => {
  it("logs cloud mode requires API key message", () => {
    (parseConfig as jest.Mock).mockReturnValue({
      mode: "cloud",
      apiKey: "",
      endpoint: "https://app.manifest.build/otlp",
      port: 2099,
      host: "127.0.0.1",
    });
    (validateConfig as jest.Mock).mockReturnValue("Missing apiKey");

    const api = makeApi();
    plugin.register(api);

    expect(api.logger.info).toHaveBeenCalledWith(
      expect.stringContaining("Cloud mode requires an API key"),
    );
  });

  it("includes tip about local mode in the message", () => {
    (parseConfig as jest.Mock).mockReturnValue({
      mode: "cloud",
      apiKey: "",
      endpoint: "https://app.manifest.build/otlp",
      port: 2099,
      host: "127.0.0.1",
    });
    (validateConfig as jest.Mock).mockReturnValue("Missing apiKey");

    const api = makeApi();
    plugin.register(api);

    expect(api.logger.info).toHaveBeenCalledWith(
      expect.stringContaining("local mode instead (zero config)"),
    );
  });
});
