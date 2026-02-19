import { OtlpKeyValue, OtlpAnyValue, OtlpResource, OtlpInstrumentationScope } from './otlp-common';

export interface OtlpExportLogsServiceRequest {
  resourceLogs: OtlpResourceLogs[];
}

export interface OtlpResourceLogs {
  resource: OtlpResource;
  scopeLogs: OtlpScopeLogs[];
}

export interface OtlpScopeLogs {
  scope: OtlpInstrumentationScope;
  logRecords: OtlpLogRecord[];
}

export interface OtlpLogRecord {
  timeUnixNano: string;
  observedTimeUnixNano?: string;
  severityNumber?: number;
  severityText?: string;
  body?: OtlpAnyValue;
  attributes?: OtlpKeyValue[];
  traceId?: string | Uint8Array;
  spanId?: string | Uint8Array;
}
