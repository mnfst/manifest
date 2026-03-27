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
    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    const api = {
      pluginConfig: {},
      config: {},
      registerService: jest.fn(),
    };
    plugin.register(api);

    expect(registerLocalMode).toHaveBeenCalled();
    consoleSpy.mockRestore();
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
});
