/**
 * OTLP protobuf definitions as a proto3 string.
 * Parsed at runtime by protobufjs for decoding application/x-protobuf payloads.
 * Based on the OpenTelemetry proto specification v1.
 */
export const OTLP_PROTO_SCHEMA = `
syntax = "proto3";

// ─── Common ───────────────────────────────────────────
message AnyValue {
  oneof value {
    string string_value = 1;
    bool bool_value = 2;
    int64 int_value = 3;
    double double_value = 4;
    ArrayValue array_value = 5;
    KeyValueList kvlist_value = 6;
    bytes bytes_value = 7;
  }
}
message ArrayValue { repeated AnyValue values = 1; }
message KeyValueList { repeated KeyValue values = 1; }
message KeyValue { string key = 1; AnyValue value = 2; }
message InstrumentationScope {
  string name = 1;
  string version = 2;
  repeated KeyValue attributes = 3;
  uint32 dropped_attributes_count = 4;
}
message Resource {
  repeated KeyValue attributes = 1;
  uint32 dropped_attributes_count = 2;
}

// ─── Traces ───────────────────────────────────────────
enum SpanKind {
  SPAN_KIND_UNSPECIFIED = 0;
  SPAN_KIND_INTERNAL = 1;
  SPAN_KIND_SERVER = 2;
  SPAN_KIND_CLIENT = 3;
  SPAN_KIND_PRODUCER = 4;
  SPAN_KIND_CONSUMER = 5;
}
enum StatusCode {
  STATUS_CODE_UNSET = 0;
  STATUS_CODE_OK = 1;
  STATUS_CODE_ERROR = 2;
}
message Status { string message = 2; StatusCode code = 3; }
message Span {
  bytes trace_id = 1;
  bytes span_id = 2;
  string trace_state = 3;
  bytes parent_span_id = 4;
  string name = 5;
  SpanKind kind = 6;
  fixed64 start_time_unix_nano = 7;
  fixed64 end_time_unix_nano = 8;
  repeated KeyValue attributes = 9;
  uint32 dropped_attributes_count = 10;
  repeated Event events = 11;
  uint32 dropped_events_count = 12;
  repeated Link links = 13;
  uint32 dropped_links_count = 14;
  Status status = 15;
  message Event {
    fixed64 time_unix_nano = 1;
    string name = 2;
    repeated KeyValue attributes = 3;
    uint32 dropped_attributes_count = 4;
  }
  message Link {
    bytes trace_id = 1;
    bytes span_id = 2;
    string trace_state = 3;
    repeated KeyValue attributes = 4;
    uint32 dropped_attributes_count = 5;
  }
}
message ScopeSpans {
  InstrumentationScope scope = 1;
  repeated Span spans = 2;
}
message ResourceSpans {
  Resource resource = 1;
  repeated ScopeSpans scope_spans = 2;
}
message ExportTraceServiceRequest {
  repeated ResourceSpans resource_spans = 1;
}
message ExportTraceServiceResponse {}

// ─── Metrics ──────────────────────────────────────────
enum AggregationTemporality {
  AGGREGATION_TEMPORALITY_UNSPECIFIED = 0;
  AGGREGATION_TEMPORALITY_DELTA = 1;
  AGGREGATION_TEMPORALITY_CUMULATIVE = 2;
}
message NumberDataPoint {
  repeated KeyValue attributes = 7;
  fixed64 start_time_unix_nano = 2;
  fixed64 time_unix_nano = 3;
  oneof value {
    double as_double = 4;
    sfixed64 as_int = 6;
  }
}
message Gauge { repeated NumberDataPoint data_points = 1; }
message Sum {
  repeated NumberDataPoint data_points = 1;
  AggregationTemporality aggregation_temporality = 2;
  bool is_monotonic = 3;
}
message Metric {
  string name = 1;
  string description = 2;
  string unit = 3;
  oneof data {
    Gauge gauge = 5;
    Sum sum = 7;
  }
}
message ScopeMetrics {
  InstrumentationScope scope = 1;
  repeated Metric metrics = 2;
}
message ResourceMetrics {
  Resource resource = 1;
  repeated ScopeMetrics scope_metrics = 2;
}
message ExportMetricsServiceRequest {
  repeated ResourceMetrics resource_metrics = 1;
}
message ExportMetricsServiceResponse {}

// ─── Logs ─────────────────────────────────────────────
enum SeverityNumber {
  SEVERITY_NUMBER_UNSPECIFIED = 0;
  SEVERITY_NUMBER_TRACE = 1;
  SEVERITY_NUMBER_TRACE2 = 2;
  SEVERITY_NUMBER_TRACE3 = 3;
  SEVERITY_NUMBER_TRACE4 = 4;
  SEVERITY_NUMBER_DEBUG = 5;
  SEVERITY_NUMBER_DEBUG2 = 6;
  SEVERITY_NUMBER_DEBUG3 = 7;
  SEVERITY_NUMBER_DEBUG4 = 8;
  SEVERITY_NUMBER_INFO = 9;
  SEVERITY_NUMBER_INFO2 = 10;
  SEVERITY_NUMBER_INFO3 = 11;
  SEVERITY_NUMBER_INFO4 = 12;
  SEVERITY_NUMBER_WARN = 13;
  SEVERITY_NUMBER_WARN2 = 14;
  SEVERITY_NUMBER_WARN3 = 15;
  SEVERITY_NUMBER_WARN4 = 16;
  SEVERITY_NUMBER_ERROR = 17;
  SEVERITY_NUMBER_ERROR2 = 18;
  SEVERITY_NUMBER_ERROR3 = 19;
  SEVERITY_NUMBER_ERROR4 = 20;
  SEVERITY_NUMBER_FATAL = 21;
  SEVERITY_NUMBER_FATAL2 = 22;
  SEVERITY_NUMBER_FATAL3 = 23;
  SEVERITY_NUMBER_FATAL4 = 24;
}
message LogRecord {
  fixed64 time_unix_nano = 1;
  fixed64 observed_time_unix_nano = 11;
  SeverityNumber severity_number = 2;
  string severity_text = 3;
  AnyValue body = 5;
  repeated KeyValue attributes = 6;
  uint32 dropped_attributes_count = 7;
  uint32 flags = 8;
  bytes trace_id = 9;
  bytes span_id = 10;
}
message ScopeLogs {
  InstrumentationScope scope = 1;
  repeated LogRecord log_records = 2;
}
message ResourceLogs {
  Resource resource = 1;
  repeated ScopeLogs scope_logs = 2;
}
message ExportLogsServiceRequest {
  repeated ResourceLogs resource_logs = 1;
}
message ExportLogsServiceResponse {}
`;
