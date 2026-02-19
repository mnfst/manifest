import { parseConfig, validateConfig } from "../src/config";
import { DEFAULTS, ENV } from "../src/constants";

// Regression: Verify the DEFAULTS constant never reverts to the old wrong path.
// OTel exporters append /v1/traces etc., so the base must be /otlp, not /api/v1/otlp.
describe("DEFAULTS.ENDPOINT constant", () => {
  it("is the OTLP base path, not an API route", () => {
    expect(DEFAULTS.ENDPOINT).toBe("https://app.manifest.build/otlp");
  });

  it("does not contain /api/v1/otlp (would cause double-pathing with OTel)", () => {
    expect(DEFAULTS.ENDPOINT).not.toContain("/api/v1/otlp");
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
    expect(result.serviceName).toBe(DEFAULTS.SERVICE_NAME);
    expect(result.captureContent).toBe(false);
    expect(result.metricsIntervalMs).toBe(DEFAULTS.METRICS_INTERVAL_MS);
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

  it("respects custom serviceName", () => {
    const result = parseConfig({
      apiKey: "mnfst_abc",
      serviceName: "my-agent",
    });
    expect(result.serviceName).toBe("my-agent");
  });

  it("respects captureContent when set to true", () => {
    const result = parseConfig({
      apiKey: "mnfst_abc",
      captureContent: true,
    });
    expect(result.captureContent).toBe(true);
  });

  it("clamps metricsIntervalMs below minimum to default", () => {
    const result = parseConfig({
      apiKey: "mnfst_abc",
      metricsIntervalMs: 1000,
    });
    expect(result.metricsIntervalMs).toBe(DEFAULTS.METRICS_INTERVAL_MS);
  });

  it("accepts metricsIntervalMs at minimum", () => {
    const result = parseConfig({
      apiKey: "mnfst_abc",
      metricsIntervalMs: 5000,
    });
    expect(result.metricsIntervalMs).toBe(5000);
  });

  it("ignores non-string apiKey", () => {
    const result = parseConfig({ apiKey: 12345 });
    expect(result.apiKey).toBe("");
  });

  it("ignores empty endpoint string", () => {
    const result = parseConfig({ apiKey: "mnfst_abc", endpoint: "" });
    expect(result.endpoint).toBe(DEFAULTS.ENDPOINT);
  });

  // Regression: DEFAULTS.ENDPOINT must be the OTLP base path, not an API route.
  // OTel exporters append /v1/traces, /v1/metrics, /v1/logs to the endpoint.
  // The backend controller is @Controller('otlp/v1'), so the correct base is /otlp.
  // Using /api/v1/otlp would produce /api/v1/otlp/v1/traces — a 404.
  it("returns correct default endpoint (otlp base, not api route)", () => {
    const result = parseConfig({});
    expect(result.endpoint).toBe("https://app.manifest.build/otlp");
    expect(result.endpoint).not.toContain("/api/v1/otlp");
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

describe("validateConfig", () => {
  const validConfig = {
    apiKey: "mnfst_abc",
    endpoint: "https://app.manifest.build/otlp",
    serviceName: "test",
    captureContent: false,
    metricsIntervalMs: 30000,
  };

  it("accepts valid config", () => {
    expect(validateConfig(validConfig)).toBeNull();
  });

  it("rejects missing apiKey with actionable fix command", () => {
    const config = { ...validConfig, apiKey: "" };
    const err = validateConfig(config)!;
    expect(err).toContain("Missing apiKey");
    expect(err).toContain("openclaw config set");
    expect(err).toContain("MANIFEST_API_KEY");
  });

  it("rejects invalid apiKey prefix with actionable fix command", () => {
    const config = { ...validConfig, apiKey: "wrong_prefix" };
    const err = validateConfig(config)!;
    expect(err).toContain("mnfst_");
    expect(err).toContain("openclaw config set");
  });

  it("rejects invalid endpoint URL with actionable fix command", () => {
    const config = { ...validConfig, endpoint: "not-a-url" };
    const err = validateConfig(config)!;
    expect(err).toContain("Invalid endpoint URL");
    expect(err).toContain("openclaw config set");
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
  // Previously it showed /api/v1/otlp which would produce a 404.
  it("shows correct example endpoint in validation error message", () => {
    const config = { ...validConfig, endpoint: "not-a-url" };
    const err = validateConfig(config)!;
    expect(err).toContain("https://app.manifest.build/otlp");
    expect(err).not.toContain("/api/v1/otlp");
  });
});
