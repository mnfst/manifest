import { stripOtlpSuffix } from "../src/compat";

const mockLogger = {
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

beforeEach(() => jest.clearAllMocks());

describe("stripOtlpSuffix", () => {
  it("strips /otlp suffix from endpoint", () => {
    expect(stripOtlpSuffix("https://app.manifest.build/otlp", mockLogger)).toBe(
      "https://app.manifest.build",
    );
  });

  it("strips /otlp/v1 suffix from endpoint", () => {
    expect(stripOtlpSuffix("https://app.manifest.build/otlp/v1", mockLogger)).toBe(
      "https://app.manifest.build",
    );
  });

  it("strips /otlp/v1/ suffix with trailing slash", () => {
    expect(stripOtlpSuffix("https://app.manifest.build/otlp/v1/", mockLogger)).toBe(
      "https://app.manifest.build",
    );
  });

  it("logs deprecation warning when suffix is detected", () => {
    stripOtlpSuffix("http://localhost:3001/otlp", mockLogger);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining("deprecated /otlp suffix"),
    );
  });

  it("returns endpoint unchanged when no /otlp suffix", () => {
    expect(stripOtlpSuffix("https://app.manifest.build", mockLogger)).toBe(
      "https://app.manifest.build",
    );
  });

  it("does not log warning when no suffix detected", () => {
    stripOtlpSuffix("https://app.manifest.build", mockLogger);
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  it("handles logger without warn method", () => {
    const minimalLogger = { info: jest.fn(), debug: jest.fn(), error: jest.fn() };
    expect(() => stripOtlpSuffix("http://localhost/otlp", minimalLogger)).not.toThrow();
  });
});
