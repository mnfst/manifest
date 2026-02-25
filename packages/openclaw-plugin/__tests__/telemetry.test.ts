import { ManifestConfig } from "../src/config";
import { PluginLogger } from "../src/telemetry";

// --- Mocks for OpenTelemetry modules ---
const mockRegister = jest.fn();
const mockShutdown = jest.fn().mockResolvedValue(undefined);

jest.mock("@opentelemetry/sdk-trace-base", () => ({
  BasicTracerProvider: jest.fn().mockImplementation(() => ({
    register: mockRegister,
    shutdown: mockShutdown,
  })),
  BatchSpanProcessor: jest.fn(),
}));

const mockMeterShutdown = jest.fn().mockResolvedValue(undefined);

jest.mock("@opentelemetry/sdk-metrics", () => ({
  MeterProvider: jest.fn().mockImplementation(() => ({
    shutdown: mockMeterShutdown,
  })),
  PeriodicExportingMetricReader: jest.fn(),
}));

jest.mock("@opentelemetry/exporter-trace-otlp-http", () => ({
  OTLPTraceExporter: jest.fn(),
}));

jest.mock("@opentelemetry/exporter-metrics-otlp-http", () => ({
  OTLPMetricExporter: jest.fn(),
}));

jest.mock("@opentelemetry/resources", () => ({
  Resource: jest.fn(),
}));

const mockGetTracer = jest.fn().mockReturnValue({ startSpan: jest.fn() });
const mockGetMeter = jest.fn().mockReturnValue({ createCounter: jest.fn() });
const mockSetGlobalMeterProvider = jest.fn();

jest.mock("@opentelemetry/api", () => ({
  trace: { getTracer: mockGetTracer },
  metrics: {
    getMeter: mockGetMeter,
    setGlobalMeterProvider: mockSetGlobalMeterProvider,
  },
}));

// Import after mocks
import {
  initTelemetry,
  getTracer,
  getMeter,
  shutdownTelemetry,
} from "../src/telemetry";
import { BasicTracerProvider, BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { Resource } from "@opentelemetry/resources";
import { MeterProvider, PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";

const config: ManifestConfig = {
  mode: "cloud",
  apiKey: "mnfst_test_key",
  endpoint: "http://localhost:3001/otlp",
  serviceName: "test-service",
  captureContent: false,
  metricsIntervalMs: 15000,
  port: 2099,
  host: "127.0.0.1",
};

const mockLogger: PluginLogger = {
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("initTelemetry", () => {
  it("uses BasicTracerProvider from sdk-trace-base", () => {
    initTelemetry(config, mockLogger);

    expect(BasicTracerProvider).toHaveBeenCalledTimes(1);
    expect(BasicTracerProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: expect.anything(),
        spanProcessors: expect.arrayContaining([expect.anything()]),
      }),
    );
  });

  it("registers the tracer provider", () => {
    initTelemetry(config, mockLogger);

    expect(mockRegister).toHaveBeenCalledTimes(1);
  });

  it("creates a Resource with serviceName and plugin version", () => {
    initTelemetry(config, mockLogger);

    expect(Resource).toHaveBeenCalledWith(
      expect.objectContaining({
        "service.name": "test-service",
        "manifest.plugin": "true",
      }),
    );
  });

  it("configures OTLPTraceExporter with endpoint and auth header", () => {
    initTelemetry(config, mockLogger);

    expect(OTLPTraceExporter).toHaveBeenCalledWith({
      url: "http://localhost:3001/otlp/v1/traces",
      headers: { Authorization: "Bearer mnfst_test_key" },
    });
  });

  it("configures OTLPMetricExporter with endpoint and auth header", () => {
    initTelemetry(config, mockLogger);

    expect(OTLPMetricExporter).toHaveBeenCalledWith({
      url: "http://localhost:3001/otlp/v1/metrics",
      headers: { Authorization: "Bearer mnfst_test_key" },
    });
  });

  it("sends empty headers when apiKey is empty (dev mode)", () => {
    const devConfig = { ...config, mode: "dev" as const, apiKey: "" };
    initTelemetry(devConfig, mockLogger);

    expect(OTLPTraceExporter).toHaveBeenCalledWith({
      url: "http://localhost:3001/otlp/v1/traces",
      headers: {},
    });
    expect(OTLPMetricExporter).toHaveBeenCalledWith({
      url: "http://localhost:3001/otlp/v1/metrics",
      headers: {},
    });
  });

  it("creates BatchSpanProcessor with tuned settings", () => {
    initTelemetry(config, mockLogger);

    expect(BatchSpanProcessor).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        scheduledDelayMillis: 5000,
        maxQueueSize: 2048,
        maxExportBatchSize: 512,
      }),
    );
  });

  it("creates MeterProvider with PeriodicExportingMetricReader", () => {
    initTelemetry(config, mockLogger);

    expect(PeriodicExportingMetricReader).toHaveBeenCalledWith(
      expect.objectContaining({
        exportIntervalMillis: 15000,
      }),
    );
    expect(MeterProvider).toHaveBeenCalledTimes(1);
    expect(mockSetGlobalMeterProvider).toHaveBeenCalledTimes(1);
  });

  it("returns tracer and meter", () => {
    const result = initTelemetry(config, mockLogger);

    expect(result).toHaveProperty("tracer");
    expect(result).toHaveProperty("meter");
    expect(mockGetTracer).toHaveBeenCalledWith(
      "manifest-plugin",
      process.env.PLUGIN_VERSION,
    );
    expect(mockGetMeter).toHaveBeenCalledWith(
      "manifest-plugin",
      process.env.PLUGIN_VERSION,
    );
  });

  it("logs trace and metrics exporter endpoints", () => {
    initTelemetry(config, mockLogger);

    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining("Trace exporter ->"),
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining("Metrics exporter ->"),
    );
  });
});

describe("getTracer / getMeter", () => {
  it("throws when telemetry is not initialized", async () => {
    // Shut down first to clear state from other tests
    await shutdownTelemetry(mockLogger);

    expect(() => getTracer()).toThrow("Telemetry not initialized");
    expect(() => getMeter()).toThrow("Telemetry not initialized");
  });

  it("returns tracer/meter after initialization", () => {
    initTelemetry(config, mockLogger);

    expect(() => getTracer()).not.toThrow();
    expect(() => getMeter()).not.toThrow();
  });
});

describe("shutdownTelemetry", () => {
  it("shuts down both providers", async () => {
    initTelemetry(config, mockLogger);

    await shutdownTelemetry(mockLogger);

    expect(mockShutdown).toHaveBeenCalledTimes(1);
    expect(mockMeterShutdown).toHaveBeenCalledTimes(1);
  });

  it("logs shutdown messages", async () => {
    initTelemetry(config, mockLogger);

    await shutdownTelemetry(mockLogger);

    expect(mockLogger.info).toHaveBeenCalledWith(
      "[manifest] Shutting down telemetry...",
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      "[manifest] Telemetry shut down",
    );
  });

  it("clears tracer/meter so getTracer/getMeter throw", async () => {
    initTelemetry(config, mockLogger);
    await shutdownTelemetry(mockLogger);

    expect(() => getTracer()).toThrow();
    expect(() => getMeter()).toThrow();
  });

  it("handles double shutdown gracefully", async () => {
    initTelemetry(config, mockLogger);

    await shutdownTelemetry(mockLogger);
    await shutdownTelemetry(mockLogger);

    // Providers only shut down once (nulled after first call)
    expect(mockShutdown).toHaveBeenCalledTimes(1);
    expect(mockMeterShutdown).toHaveBeenCalledTimes(1);
  });
});
