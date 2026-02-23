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
}));
jest.mock("../src/product-telemetry", () => ({
  trackPluginEvent: jest.fn(),
}));

import { parseConfig, validateConfig } from "../src/config";
import { registerLocalMode } from "../src/local-mode";
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
      serviceName: "test",
      captureContent: false,
      metricsIntervalMs: 30000,
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
      serviceName: "test",
      captureContent: false,
      metricsIntervalMs: 30000,
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
      serviceName: "test",
      captureContent: false,
      metricsIntervalMs: 30000,
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

describe("register — cloud mode missing API key", () => {
  it("logs cloud mode requires API key message", () => {
    (parseConfig as jest.Mock).mockReturnValue({
      mode: "cloud",
      apiKey: "",
      endpoint: "https://app.manifest.build/otlp",
      serviceName: "test",
      captureContent: false,
      metricsIntervalMs: 30000,
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
      serviceName: "test",
      captureContent: false,
      metricsIntervalMs: 30000,
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
