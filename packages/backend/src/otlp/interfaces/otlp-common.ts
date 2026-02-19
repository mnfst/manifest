export interface OtlpKeyValue {
  key: string;
  value: OtlpAnyValue;
}

export interface OtlpAnyValue {
  stringValue?: string;
  intValue?: string | number;
  doubleValue?: number;
  boolValue?: boolean;
  arrayValue?: { values: OtlpAnyValue[] };
  kvlistValue?: { values: OtlpKeyValue[] };
  bytesValue?: string;
}

export interface OtlpResource {
  attributes: OtlpKeyValue[];
  droppedAttributesCount?: number;
}

export interface OtlpInstrumentationScope {
  name: string;
  version?: string;
  attributes?: OtlpKeyValue[];
}
