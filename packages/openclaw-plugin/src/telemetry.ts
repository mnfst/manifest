import {
  BasicTracerProvider,
  BatchSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import {
  MeterProvider,
  PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { Resource } from "@opentelemetry/resources";
import { trace, metrics, Tracer, Meter } from "@opentelemetry/api";
import { ManifestConfig } from "./config";

export interface PluginLogger {
  info: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
  warn?: (...args: unknown[]) => void;
}

let tracerProvider: BasicTracerProvider | null = null;
let meterProvider: MeterProvider | null = null;
let tracer: Tracer | null = null;
let meter: Meter | null = null;

export function initTelemetry(
  config: ManifestConfig,
  logger: PluginLogger,
): { tracer: Tracer; meter: Meter } {
  const resource = new Resource({
    "service.name": config.serviceName,
    "service.version": process.env.PLUGIN_VERSION || "0.0.0",
    "manifest.plugin": "true",
  });

  const headers = { Authorization: `Bearer ${config.apiKey}` };

  // Trace exporter
  const traceExporter = new OTLPTraceExporter({
    url: `${config.endpoint}/v1/traces`,
    headers,
  });

  tracerProvider = new BasicTracerProvider({
    resource,
    spanProcessors: [
      new BatchSpanProcessor(traceExporter, {
        scheduledDelayMillis: 5000,
        maxQueueSize: 2048,
        maxExportBatchSize: 512,
      }),
    ],
  });
  tracerProvider.register();
  logger.info(`[manifest] Trace exporter -> ${config.endpoint}/v1/traces`);

  // Metrics exporter
  const metricExporter = new OTLPMetricExporter({
    url: `${config.endpoint}/v1/metrics`,
    headers,
  });

  meterProvider = new MeterProvider({
    resource,
    readers: [
      new PeriodicExportingMetricReader({
        exporter: metricExporter,
        exportIntervalMillis: config.metricsIntervalMs,
      }),
    ],
  });
  metrics.setGlobalMeterProvider(meterProvider);
  logger.info(
    `[manifest] Metrics exporter -> ${config.endpoint}/v1/metrics ` +
      `(interval=${config.metricsIntervalMs}ms)`,
  );

  tracer = trace.getTracer("manifest-plugin", process.env.PLUGIN_VERSION);
  meter = metrics.getMeter("manifest-plugin", process.env.PLUGIN_VERSION);

  return { tracer, meter };
}

export function getTracer(): Tracer {
  if (!tracer) throw new Error("[manifest] Telemetry not initialized");
  return tracer;
}

export function getMeter(): Meter {
  if (!meter) throw new Error("[manifest] Telemetry not initialized");
  return meter;
}

export async function shutdownTelemetry(
  logger: PluginLogger,
): Promise<void> {
  logger.info("[manifest] Shutting down telemetry...");
  if (tracerProvider) {
    await tracerProvider.shutdown();
    tracerProvider = null;
  }
  if (meterProvider) {
    await meterProvider.shutdown();
    meterProvider = null;
  }
  tracer = null;
  meter = null;
  logger.info("[manifest] Telemetry shut down");
}
