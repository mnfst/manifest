import { Injectable, OnModuleInit, UnsupportedMediaTypeException } from '@nestjs/common';
import * as protobuf from 'protobufjs';
import { OTLP_PROTO_SCHEMA } from '../proto/otlp-proto-defs';
import { OtlpExportTraceServiceRequest } from '../interfaces/otlp-trace';
import { OtlpExportMetricsServiceRequest } from '../interfaces/otlp-metric';
import { OtlpExportLogsServiceRequest } from '../interfaces/otlp-log';

const CONTENT_JSON = 'application/json';
const CONTENT_PROTO = 'application/x-protobuf';

@Injectable()
export class OtlpDecoderService implements OnModuleInit {
  private traceType!: protobuf.Type;
  private metricsType!: protobuf.Type;
  private logsType!: protobuf.Type;

  onModuleInit(): void {
    const { root } = protobuf.parse(OTLP_PROTO_SCHEMA);
    this.traceType = root.lookupType('ExportTraceServiceRequest');
    this.metricsType = root.lookupType('ExportMetricsServiceRequest');
    this.logsType = root.lookupType('ExportLogsServiceRequest');
  }

  decodeTraces(
    contentType: string | undefined,
    body: unknown,
    rawBody?: Buffer,
  ): OtlpExportTraceServiceRequest {
    return this.decode(this.traceType, contentType, body, rawBody);
  }

  decodeMetrics(
    contentType: string | undefined,
    body: unknown,
    rawBody?: Buffer,
  ): OtlpExportMetricsServiceRequest {
    return this.decode(this.metricsType, contentType, body, rawBody);
  }

  decodeLogs(
    contentType: string | undefined,
    body: unknown,
    rawBody?: Buffer,
  ): OtlpExportLogsServiceRequest {
    return this.decode(this.logsType, contentType, body, rawBody);
  }

  private decode<T>(type: protobuf.Type, contentType: string | undefined, body: unknown, rawBody?: Buffer): T {
    const ct = (contentType ?? '').split(';')[0].trim().toLowerCase();

    if (ct === CONTENT_PROTO) {
      if (!rawBody || rawBody.length === 0) {
        throw new UnsupportedMediaTypeException('Empty protobuf body');
      }
      const message = type.decode(rawBody);
      return type.toObject(message, { longs: String, bytes: String }) as T;
    }

    if (ct === CONTENT_JSON || ct === '') {
      return body as T;
    }

    throw new UnsupportedMediaTypeException(`Unsupported content type: ${ct}`);
  }
}
