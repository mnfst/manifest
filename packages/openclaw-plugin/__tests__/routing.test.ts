import { registerRouting } from "../src/routing";
import { ManifestConfig } from "../src/config";

const mockLogger = {
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

const cloudConfig: ManifestConfig = {
  mode: "cloud",
  devMode: false,
  apiKey: "mnfst_test_key",
  endpoint: "http://localhost:3001",
  port: 2099,
  host: "127.0.0.1",
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("registerRouting", () => {
  it("registers provider when registerProvider is available", () => {
    const api = { registerProvider: jest.fn() };
    registerRouting(api, cloudConfig, mockLogger);

    expect(api.registerProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "manifest",
        label: "Manifest Router",
        models: ["auto"],
      }),
    );
  });

  it("skips when registerProvider is not a function", () => {
    const api = {};
    registerRouting(api, cloudConfig, mockLogger);

    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining("not available"),
    );
  });

  it("handles registerProvider error gracefully", () => {
    const api = { registerProvider: jest.fn(() => { throw new Error("fail"); }) };
    registerRouting(api, cloudConfig, mockLogger);

    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining("registerProvider failed"),
    );
  });
});
