// Mock all dependencies before importing the module under test
jest.mock("../src/telemetry", () => ({
  initTelemetry: jest.fn(() => ({ tracer: {}, meter: {} })),
  shutdownTelemetry: jest.fn(),
}));
jest.mock("../src/hooks", () => ({
  registerHooks: jest.fn(),
  initMetrics: jest.fn(),
}));
jest.mock("../src/routing", () => ({ registerRouting: jest.fn() }));
jest.mock("../src/tools", () => ({ registerTools: jest.fn() }));
jest.mock("../src/verify", () => ({
  verifyConnection: jest.fn().mockResolvedValue({ error: null, agentName: "test-agent" }),
}));
jest.mock("../src/local-mode", () => ({
  registerLocalMode: jest.fn(),
}));
jest.mock("../src/product-telemetry", () => ({
  trackPluginEvent: jest.fn(),
}));

import { registerLocalMode } from "../src/local-mode";
import { trackPluginEvent } from "../src/product-telemetry";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const plugin = require("../src/index");

const mockLogger = {
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("register — mode routing", () => {
  it("delegates to registerLocalMode when mode defaults to local", () => {
    const api = {
      logger: mockLogger,
      pluginConfig: {},
      config: {},
      registerService: jest.fn(),
      registerTool: jest.fn(),
    };

    plugin.register(api);

    expect(registerLocalMode).toHaveBeenCalledWith(
      api,
      expect.objectContaining({ mode: "local" }),
      expect.anything(),
    );
  });

  it("delegates to registerLocalMode for explicit local mode", () => {
    const api = {
      logger: mockLogger,
      pluginConfig: { mode: "local" },
      config: {},
      registerService: jest.fn(),
      registerTool: jest.fn(),
    };

    plugin.register(api);

    expect(registerLocalMode).toHaveBeenCalled();
  });

  it("does not delegate to registerLocalMode for cloud mode", () => {
    const api = {
      logger: mockLogger,
      pluginConfig: { mode: "cloud", apiKey: "mnfst_abc" },
      config: { plugins: { entries: {} } },
      registerService: jest.fn(),
      registerTool: jest.fn(),
    };

    plugin.register(api);

    expect(registerLocalMode).not.toHaveBeenCalled();
  });

  it("tracks plugin_mode_selected event with correct mode", () => {
    const api = {
      logger: mockLogger,
      pluginConfig: { mode: "cloud", apiKey: "mnfst_abc" },
      config: { plugins: { entries: {} } },
      registerService: jest.fn(),
      registerTool: jest.fn(),
    };

    plugin.register(api);

    expect(trackPluginEvent).toHaveBeenCalledWith("plugin_mode_selected", {
      mode: "cloud",
    });
  });
});

describe("register — cloud mode missing API key message", () => {
  it("logs actionable message when cloud mode has no API key", () => {
    const api = {
      logger: mockLogger,
      pluginConfig: { mode: "cloud" },
      config: {},
      registerService: jest.fn(),
      registerTool: jest.fn(),
    };

    plugin.register(api);

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining("Cloud mode requires an API key"),
    );
  });

  it("includes tip about local mode in the missing key message", () => {
    const api = {
      logger: mockLogger,
      pluginConfig: { mode: "cloud" },
      config: {},
      registerService: jest.fn(),
      registerTool: jest.fn(),
    };

    plugin.register(api);

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining("Tip: Remove the mode setting to use local mode instead"),
    );
  });

  it("includes config set command in the missing key message", () => {
    const api = {
      logger: mockLogger,
      pluginConfig: { mode: "cloud" },
      config: {},
      registerService: jest.fn(),
      registerTool: jest.fn(),
    };

    plugin.register(api);

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining("openclaw config set"),
    );
  });

  it("logs error (not info) for invalid API key prefix in cloud mode", () => {
    const api = {
      logger: mockLogger,
      pluginConfig: { mode: "cloud", apiKey: "bad_prefix_key" },
      config: {},
      registerService: jest.fn(),
      registerTool: jest.fn(),
    };

    plugin.register(api);

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining("Configuration error"),
    );
    expect(mockLogger.info).not.toHaveBeenCalledWith(
      expect.stringContaining("Cloud mode requires an API key"),
    );
  });
});

describe("register — zero-config defaults to local", () => {
  it("uses local mode with no pluginConfig at all", () => {
    const api = {
      logger: mockLogger,
      pluginConfig: undefined,
      config: {},
      registerService: jest.fn(),
      registerTool: jest.fn(),
    };

    plugin.register(api);

    expect(registerLocalMode).toHaveBeenCalledWith(
      api,
      expect.objectContaining({ mode: "local" }),
      expect.anything(),
    );
  });

  it("uses local mode with null pluginConfig", () => {
    const api = {
      logger: mockLogger,
      pluginConfig: null,
      config: {},
      registerService: jest.fn(),
      registerTool: jest.fn(),
    };

    plugin.register(api);

    expect(registerLocalMode).toHaveBeenCalledWith(
      api,
      expect.objectContaining({ mode: "local" }),
      expect.anything(),
    );
  });
});
