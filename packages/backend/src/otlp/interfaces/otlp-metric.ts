import { OtlpKeyValue, OtlpResource, OtlpInstrumentationScope } from './otlp-common';

export interface OtlpExportMetricsServiceRequest {
  resourceMetrics: OtlpResourceMetrics[];
}

export interface OtlpResourceMetrics {
  resource: OtlpResource;
  scopeMetrics: OtlpScopeMetrics[];
}

export interface OtlpScopeMetrics {
  scope: OtlpInstrumentationScope;
  metrics: OtlpMetric[];
}

export interface OtlpNumberDataPoint {
  attributes?: OtlpKeyValue[];
  startTimeUnixNano?: string;
  timeUnixNano: string;
  asInt?: string | number;
  asDouble?: number;
}

export interface OtlpGauge {
  dataPoints: OtlpNumberDataPoint[];
}

export interface OtlpSum {
  dataPoints: OtlpNumberDataPoint[];
  aggregationTemporality: number;
  isMonotonic: boolean;
}

export interface OtlpMetric {
  name: string;
  description?: string;
  unit?: string;
  gauge?: OtlpGauge;
  sum?: OtlpSum;
}
