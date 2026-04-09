jest.mock("../src/local-mode", () => ({
  registerLocalMode: jest.fn(),
}));

import { registerLocalMode } from "../src/local-mode";

const plugin = require("../src/index");

function makeApi(pluginConfig?: unknown) {
  return {
    pluginConfig,
    config: {},
    logger: {
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    },
    registerService: jest.fn(),
  };
}

beforeEach(() => jest.clearAllMocks());

describe("manifest plugin registration", () => {
  it("has correct id and name", () => {
    expect(plugin.id).toBe("manifest");
    expect(plugin.name).toContain("Self-Hosted");
  });

  it("calls registerLocalMode with default port and host", () => {
    const api = makeApi();
    plugin.register(api);

    expect(registerLocalMode).toHaveBeenCalledWith(api, 2099, "127.0.0.1", api.logger);
  });

  it("reads port from plugin config", () => {
    const api = makeApi({ port: 3000 });
    plugin.register(api);

    expect(registerLocalMode).toHaveBeenCalledWith(api, 3000, "127.0.0.1", api.logger);
  });

  it("reads host from plugin config", () => {
    const api = makeApi({ host: "0.0.0.0" });
    plugin.register(api);

    expect(registerLocalMode).toHaveBeenCalledWith(api, 2099, "0.0.0.0", api.logger);
  });

  it("handles nested config format { config: { port, host } }", () => {
    const api = makeApi({ config: { port: 4000, host: "192.168.1.1" } });
    plugin.register(api);

    expect(registerLocalMode).toHaveBeenCalledWith(api, 4000, "192.168.1.1", api.logger);
  });

  it("uses fallback logger when api.logger is not provided", () => {
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const api = {
      pluginConfig: {},
      config: {},
      registerService: jest.fn(),
    };
    plugin.register(api);

    expect(registerLocalMode).toHaveBeenCalled();

    // Exercise each fallback logger method to cover lines 11-14
    const fallbackLogger = (registerLocalMode as jest.Mock).mock.calls[0][3];

    fallbackLogger.info("test info");
    expect(logSpy).toHaveBeenCalledWith("test info");

    fallbackLogger.debug("test debug");
    // debug is a no-op, just verify it doesn't throw

    fallbackLogger.error("test error");
    expect(errorSpy).toHaveBeenCalledWith("test error");

    fallbackLogger.warn("test warn");
    expect(warnSpy).toHaveBeenCalledWith("test warn");

    logSpy.mockRestore();
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("ignores invalid port values", () => {
    const api = makeApi({ port: -1 });
    plugin.register(api);

    expect(registerLocalMode).toHaveBeenCalledWith(api, 2099, "127.0.0.1", api.logger);
  });

  it("ignores empty host string", () => {
    const api = makeApi({ host: "" });
    plugin.register(api);

    expect(registerLocalMode).toHaveBeenCalledWith(api, 2099, "127.0.0.1", api.logger);
  });

  it("logs loading message during registration", () => {
    const api = makeApi();
    plugin.register(api);

    expect(api.logger.info).toHaveBeenCalledWith(
      expect.stringContaining("Loading embedded server"),
    );
  });
});
