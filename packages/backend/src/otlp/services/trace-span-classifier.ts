import { v4 as uuidv4 } from 'uuid';
import { OtlpSpan, OtlpResourceSpans } from '../interfaces';
import {
  extractAttributes,
  nanoToDatetime,
  toHexString,
  spanStatusToString,
  attrString,
  attrNumber,
  AttributeMap,
} from './otlp-helpers';

export interface SpanEntry {
  uuid: string;
  type: 'agent_message' | 'llm_call' | 'tool_execution' | 'root_request';
  spanId: string;
}

export function flattenSpans(rs: OtlpResourceSpans): OtlpSpan[] {
  const spans: OtlpSpan[] = [];
  for (const ss of rs.scopeSpans ?? []) {
    for (const span of ss.spans ?? []) spans.push(span);
  }
  return spans;
}

export function classifySpan(attrs: AttributeMap, spanName?: string): SpanEntry['type'] {
  if (spanName === 'openclaw.agent.turn' || (spanName && spanName.startsWith('manifest.')))
    return 'agent_message';
  if (attrString(attrs, 'gen_ai.system')) return 'llm_call';
  if (attrString(attrs, 'tool.name')) return 'tool_execution';
  // Skip root spans, HTTP auto-instrumentation, and any other unknown spans.
  // Only explicitly recognized spans above should create agent_messages.
  return 'root_request';
}

export function buildSpanMap(
  spans: OtlpSpan[],
  resourceAttrs: AttributeMap,
): Map<string, SpanEntry> {
  const map = new Map<string, SpanEntry>();
  for (const span of spans) {
    const spanId = toHexString(span.spanId);
    const attrs = { ...resourceAttrs, ...extractAttributes(span.attributes) };
    map.set(spanId, { uuid: uuidv4(), type: classifySpan(attrs, span.name), spanId });
  }
  return map;
}

export function isEmptyOkSpan(span: OtlpSpan, attrs: AttributeMap): boolean {
  if (spanStatusToString(span.status?.code) !== 'ok') return false;
  if (attrString(attrs, 'gen_ai.request.model') || attrString(attrs, 'gen_ai.response.model'))
    return false;
  const input = attrNumber(attrs, 'gen_ai.usage.input_tokens') ?? 0;
  const output = attrNumber(attrs, 'gen_ai.usage.output_tokens') ?? 0;
  return input === 0 && output === 0;
}

export function filterGhostSpans(
  spans: OtlpSpan[],
  resourceAttrs: AttributeMap,
  spanMap: Map<string, SpanEntry>,
): Set<string> {
  const ghostIds = new Set<string>();
  const msgSpans: { spanId: string; time: number; empty: boolean }[] = [];

  for (const span of spans) {
    const spanId = toHexString(span.spanId);
    const entry = spanMap.get(spanId);
    if (entry?.type !== 'agent_message') continue;
    const attrs = { ...resourceAttrs, ...extractAttributes(span.attributes) };
    const time = new Date(nanoToDatetime(span.startTimeUnixNano)).getTime();
    msgSpans.push({ spanId, time, empty: isEmptyOkSpan(span, attrs) });
  }

  for (const ms of msgSpans) {
    if (!ms.empty) continue;
    const hasSibling = msgSpans.some(
      (other) => !other.empty && Math.abs(other.time - ms.time) <= 60_000,
    );
    if (hasSibling) ghostIds.add(ms.spanId);
  }
  return ghostIds;
}
