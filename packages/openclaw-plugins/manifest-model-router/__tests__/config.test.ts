import { parseConfig, validateConfig } from "../src/config";
import { API_KEY_PREFIX, DEFAULTS, ENV } from "../src/constants";

describe("API_KEY_PREFIX constant", () => {
  it("equals mnfst_ (catches accidental revert)", () => {
    expect(API_KEY_PREFIX).toBe("mnfst_");
  });

  it("does not equal the old osk_ prefix", () => {
    expect(API_KEY_PREFIX).not.toBe("osk_");
  });
});

// Regression: Verify the DEFAULTS constant is the base origin, not an OTLP path.
describe("DEFAULTS.ENDPOINT constant", () => {
  it("is the base origin without path suffix", () => {
    expect(DEFAULTS.ENDPOINT).toBe("https://app.manifest.build");
  });

  it("does not contain /otlp", () => {
    expect(DEFAULTS.ENDPOINT).not.toContain("/otlp");
  });
});

const originalEnv = process.env;

beforeEach(() => {
  process.env = { ...originalEnv };
  delete process.env[ENV.API_KEY];
  delete process.env[ENV.ENDPOINT];
});

afterAll(() => {
  process.env = originalEnv;
});

describe("parseConfig", () => {
  it("parses flat config", () => {
    const result = parseConfig({
      apiKey: "mnfst_abc",
      endpoint: "http://localhost:3000/otlp",
    });
    expect(result.apiKey).toBe("mnfst_abc");
    expect(result.endpoint).toBe("http://localhost:3000/otlp");
  });

  it("unwraps nested { enabled, config: {...} } wrapper", () => {
    const result = parseConfig({
      enabled: true,
      config: { apiKey: "mnfst_abc", endpoint: "http://localhost:3000/otlp" },
    });
    expect(result.apiKey).toBe("mnfst_abc");
    expect(result.endpoint).toBe("http://localhost:3000/otlp");
  });

  it("applies defaults for missing fields", () => {
    const result = parseConfig({ apiKey: "mnfst_abc" });
    expect(result.endpoint).toBe(DEFAULTS.ENDPOINT);
  });

  it("enables devMode for legacy mode: dev", () => {
    const result = parseConfig({ mode: "dev", endpoint: "http://localhost:38238/otlp" });
    expect(result.devMode).toBe(true);
  });

  it("preserves legacy mode: dev through nested config wrapper", () => {
    const result = parseConfig({
      enabled: true,
      config: { mode: "dev", endpoint: "http://localhost:38238/otlp" },
    });
    expect(result.devMode).toBe(true);
  });

  it("ignores unknown mode values", () => {
    const result = parseConfig({ mode: "hybrid" });
    expect(result.devMode).toBe(false);
  });

  it("ignores non-string mode values", () => {
    const result = parseConfig({ mode: 42 });
    expect(result.devMode).toBe(false);
  });

  it("ignores legacy mode: local silently", () => {
    const result = parseConfig({ mode: "local" });
    expect(result.devMode).toBe(false);
  });

  it("works with empty object", () => {
    const result = parseConfig({});
    expect(result.devMode).toBe(false);
    expect(result.endpoint).toBe(DEFAULTS.ENDPOINT);
  });

  it("works with null input", () => {
    const result = parseConfig(null);
    expect(result.devMode).toBe(false);
    expect(result.endpoint).toBe(DEFAULTS.ENDPOINT);
  });

  it("defaults port and host", () => {
    const result = parseConfig({ apiKey: "mnfst_abc" });
    expect(result.port).toBe(2099);
    expect(result.host).toBe("127.0.0.1");
  });

  it("handles null/undefined input gracefully", () => {
    const result = parseConfig(null);
    expect(result.apiKey).toBe("");
    expect(result.endpoint).toBe(DEFAULTS.ENDPOINT);
  });

  it("handles array input gracefully", () => {
    const result = parseConfig([1, 2, 3]);
    expect(result.apiKey).toBe("");
  });

  it("ignores non-string apiKey", () => {
    const result = parseConfig({ apiKey: 12345 });
    expect(result.apiKey).toBe("");
  });

  it("ignores empty endpoint string", () => {
    const result = parseConfig({ apiKey: "mnfst_abc", endpoint: "" });
    expect(result.endpoint).toBe(DEFAULTS.ENDPOINT);
  });

  // Regression: DEFAULTS.ENDPOINT must be the base origin, not a sub-path.
  it("returns correct default endpoint (base origin, not otlp path)", () => {
    const result = parseConfig({});
    expect(result.endpoint).toBe("https://app.manifest.build");
    expect(result.endpoint).not.toContain("/otlp");
  });

  // Env var fallback tests
  it("falls back to MANIFEST_API_KEY env var when apiKey missing", () => {
    process.env[ENV.API_KEY] = "mnfst_from_env";
    const result = parseConfig({});
    expect(result.apiKey).toBe("mnfst_from_env");
  });

  it("falls back to MANIFEST_ENDPOINT env var when endpoint missing", () => {
    process.env[ENV.ENDPOINT] = "http://custom:3001/otlp";
    const result = parseConfig({ apiKey: "mnfst_abc" });
    expect(result.endpoint).toBe("http://custom:3001/otlp");
  });

  it("plugin config apiKey takes priority over env var", () => {
    process.env[ENV.API_KEY] = "mnfst_from_env";
    const result = parseConfig({ apiKey: "mnfst_from_config" });
    expect(result.apiKey).toBe("mnfst_from_config");
  });

  it("plugin config endpoint takes priority over env var", () => {
    process.env[ENV.ENDPOINT] = "http://env:3001/otlp";
    const result = parseConfig({
      apiKey: "mnfst_abc",
      endpoint: "http://config:3001/otlp",
    });
    expect(result.endpoint).toBe("http://config:3001/otlp");
  });

  it("ignores empty MANIFEST_ENDPOINT env var", () => {
    process.env[ENV.ENDPOINT] = "";
    const result = parseConfig({ apiKey: "mnfst_abc" });
    expect(result.endpoint).toBe(DEFAULTS.ENDPOINT);
  });
});

describe("parseConfig — devMode", () => {
  it("auto-detects devMode when endpoint is loopback and no mnfst_ key", () => {
    const result = parseConfig({
      endpoint: "http://localhost:38238/otlp",
    });
    expect(result.devMode).toBe(true);
  });

  it("auto-detects devMode for 127.0.0.1", () => {
    const result = parseConfig({
      endpoint: "http://127.0.0.1:38238/otlp",
    });
    expect(result.devMode).toBe(true);
  });

  it("auto-detects devMode for ::1", () => {
    const result = parseConfig({
      endpoint: "http://[::1]:38238/otlp",
    });
    expect(result.devMode).toBe(true);
  });

  it("does not auto-detect devMode when mnfst_ key is present", () => {
    const result = parseConfig({
      endpoint: "http://localhost:38238/otlp",
      apiKey: "mnfst_abc",
    });
    expect(result.devMode).toBe(false);
  });

  it("does not auto-detect devMode for remote endpoints", () => {
    const result = parseConfig({
      endpoint: "https://app.manifest.build/otlp",
    });
    expect(result.devMode).toBe(false);
  });

  it("respects explicit devMode: true", () => {
    const result = parseConfig({
      devMode: true,
      endpoint: "https://app.manifest.build/otlp",
      apiKey: "mnfst_abc",
    });
    expect(result.devMode).toBe(true);
  });

  it("respects explicit devMode: false even with loopback", () => {
    const result = parseConfig({
      devMode: false,
      endpoint: "http://localhost:38238/otlp",
    });
    expect(result.devMode).toBe(false);
  });

  it("does not auto-detect devMode with non-URL endpoint", () => {
    const result = parseConfig({
      endpoint: "not-a-url",
    });
    expect(result.devMode).toBe(false);
  });

  it("auto-detects devMode false for default cloud endpoint with no key", () => {
    const result = parseConfig({});
    expect(result.devMode).toBe(false);
  });
});

describe("validateConfig", () => {
  const validConfig = {
    devMode: false,
    apiKey: "mnfst_abc",
    endpoint: "https://app.manifest.build/otlp",
    port: 2099,
    host: "127.0.0.1",
  };

  it("accepts valid config", () => {
    expect(validateConfig(validConfig)).toBeNull();
  });

  it("accepts devMode with valid http endpoint (no apiKey required)", () => {
    const config = {
      ...validConfig,
      devMode: true,
      apiKey: "",
      endpoint: "http://localhost:38238/otlp",
    };
    expect(validateConfig(config)).toBeNull();
  });

  it("accepts devMode with https endpoint", () => {
    const config = {
      ...validConfig,
      devMode: true,
      apiKey: "",
      endpoint: "https://dev.example.com/otlp",
    };
    expect(validateConfig(config)).toBeNull();
  });

  it("rejects devMode with invalid endpoint", () => {
    const config = {
      ...validConfig,
      devMode: true,
      apiKey: "",
      endpoint: "not-a-url",
    };
    const err = validateConfig(config)!;
    expect(err).toContain("Invalid endpoint URL");
    expect(err).toContain("http://localhost:<PORT>");
  });

  it("uses correct plugin name in devMode endpoint error", () => {
    const config = {
      ...validConfig,
      devMode: true,
      apiKey: "",
      endpoint: "not-a-url",
    };
    const err = validateConfig(config)!;
    expect(err).toContain("manifest-model-router.config.endpoint");
  });

  it("rejects missing apiKey with actionable fix command", () => {
    const config = { ...validConfig, apiKey: "" };
    const err = validateConfig(config)!;
    expect(err).toContain("Missing apiKey");
    expect(err).toContain("openclaw config set");
    expect(err).toContain("MANIFEST_API_KEY");
  });

  it("uses correct plugin name in missing apiKey error", () => {
    const config = { ...validConfig, apiKey: "" };
    const err = validateConfig(config)!;
    expect(err).toContain("manifest-model-router.config.apiKey");
  });

  it("rejects invalid apiKey prefix with actionable fix command", () => {
    const config = { ...validConfig, apiKey: "wrong_prefix" };
    const err = validateConfig(config)!;
    expect(err).toContain("mnfst_");
    expect(err).toContain("openclaw config set");
  });

  it("uses correct plugin name in invalid apiKey error", () => {
    const config = { ...validConfig, apiKey: "wrong_prefix" };
    const err = validateConfig(config)!;
    expect(err).toContain("manifest-model-router.config.apiKey");
  });

  it("rejects keys with old osk_ prefix", () => {
    const config = { ...validConfig, apiKey: "osk_some_old_key" };
    const err = validateConfig(config)!;
    expect(err).toContain("Invalid apiKey format");
    expect(err).toContain("mnfst_");
  });

  it("rejects invalid endpoint URL with actionable fix command", () => {
    const config = { ...validConfig, endpoint: "not-a-url" };
    const err = validateConfig(config)!;
    expect(err).toContain("Invalid endpoint URL");
    expect(err).toContain("openclaw config set");
  });

  it("uses correct plugin name in invalid endpoint error", () => {
    const config = { ...validConfig, endpoint: "not-a-url" };
    const err = validateConfig(config)!;
    expect(err).toContain("manifest-model-router.config.endpoint");
  });

  it("accepts http endpoint", () => {
    const config = { ...validConfig, endpoint: "http://localhost:3001/otlp" };
    expect(validateConfig(config)).toBeNull();
  });

  it("accepts https endpoint", () => {
    const config = {
      ...validConfig,
      endpoint: "https://custom.endpoint.com/otlp",
    };
    expect(validateConfig(config)).toBeNull();
  });

  // Regression: the error message must show the correct endpoint example.
  it("shows correct example endpoint in validation error message", () => {
    const config = { ...validConfig, endpoint: "not-a-url" };
    const err = validateConfig(config)!;
    expect(err).toContain("https://app.manifest.build");
  });
});
