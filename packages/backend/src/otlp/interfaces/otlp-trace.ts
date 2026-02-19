import { OtlpKeyValue, OtlpResource, OtlpInstrumentationScope } from './otlp-common';

export interface OtlpExportTraceServiceRequest {
  resourceSpans: OtlpResourceSpans[];
}

export interface OtlpResourceSpans {
  resource: OtlpResource;
  scopeSpans: OtlpScopeSpans[];
}

export interface OtlpScopeSpans {
  scope: OtlpInstrumentationScope;
  spans: OtlpSpan[];
}

export interface OtlpSpanStatus {
  code: number;
  message?: string;
}

export interface OtlpSpanEvent {
  timeUnixNano: string;
  name: string;
  attributes?: OtlpKeyValue[];
}

export interface OtlpSpan {
  traceId: string | Uint8Array;
  spanId: string | Uint8Array;
  parentSpanId?: string | Uint8Array;
  name: string;
  kind: number;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  attributes: OtlpKeyValue[];
  status: OtlpSpanStatus;
  events?: OtlpSpanEvent[];
}
