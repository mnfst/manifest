import { Operation } from './operation';

/**
 * Thrown when an operation type is not in the catalog. The applicator is
 * fail-safe: it NEVER silently ignores an unknown op (which would mask drift
 * between the Healing service and this engine). Callers treat this as "do not
 * apply, surface the original error".
 */
export class UnknownOperationError extends Error {
  constructor(public readonly opType: string) {
    super(`Unknown healing operation: ${opType}`);
    this.name = 'UnknownOperationError';
  }
}

interface Msg {
  role: string;
  content: unknown;
  name?: string;
}

export interface ApplyResult {
  body: Record<string, unknown>;
  /** Redaction-safe summary of what changed: op types, scalar field diffs, message counts. */
  diff: Record<string, unknown>;
}

/** JSON deep clone — request bodies are JSON-serializable, so this is total and dep-free. */
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Apply catalog operations to an (OpenAI-shaped) request body. Pure and total:
 * no I/O, no mutation of the input. Given the same body + ops it always yields
 * the same output. Throws UnknownOperationError on an op outside the catalog.
 */
export function applyOperations(
  originalBody: Record<string, unknown>,
  ops: Operation[],
): ApplyResult {
  const body = clone(originalBody);
  for (const op of ops) applyOne(body, op);
  return { body, diff: computeDiff(originalBody, body, ops) };
}

function applyOne(body: Record<string, unknown>, op: Operation): void {
  switch (op.type) {
    case 'rename_param':
      if (op.from in body) {
        body[op.to] = body[op.from];
        delete body[op.from];
      }
      return;
    case 'drop_param':
      delete body[op.param];
      return;
    case 'clamp_param':
      if (typeof body[op.param] === 'number' && (body[op.param] as number) > op.max) {
        body[op.param] = op.max;
      }
      return;
    case 'strip_schema_keys':
      stripKeys((body.tools as unknown[]) ?? [], op.keys);
      return;
    case 'remap_model':
      if (body.model === op.from) body.model = op.to;
      return;
    case 'reorder_messages':
      body.messages = reorder((body.messages as Msg[]) ?? [], op.rule);
      return;
    case 'inject_field':
      setPath(body, op.path, op.value);
      return;
    case 'trim_context':
      body.messages = trim((body.messages as Msg[]) ?? [], op.strategy, op.targetTokens);
      return;
    case 'drop_orphan_tool_messages':
      body.messages = dropOrphanTools((body.messages as Msg[]) ?? []);
      return;
    case 'strip_message_keys':
      body.messages = stripMessageKeys((body.messages as Msg[]) ?? [], op.keys);
      return;
    case 'ensure_array_items':
      ensureArrayItems(body.tools);
      ensureArrayItems(body.response_format);
      return;
    case 'drop_oversized_content':
      body.messages = dropOversized((body.messages as Msg[]) ?? [], op.maxBytes);
      return;
    default:
      // Fail-safe: an unknown op type (catalog drift) is rejected, never ignored.
      throw new UnknownOperationError((op as { type: string }).type);
  }
}

/** Remove tool-role messages not preceded by an assistant `tool_calls` turn. */
function dropOrphanTools(messages: Msg[]): Msg[] {
  const out: Msg[] = [];
  for (const m of messages) {
    if (m.role === 'tool') {
      const prev = out[out.length - 1] as (Msg & { tool_calls?: unknown }) | undefined;
      const ok =
        prev?.role === 'assistant' && Array.isArray(prev.tool_calls) && prev.tool_calls.length > 0;
      if (!ok) continue;
    }
    out.push(m);
  }
  return out;
}

/** Delete stray keys (e.g. replayed `reasoning_content`) from every message. */
function stripMessageKeys(messages: Msg[], keys: string[]): Msg[] {
  return messages.map((m) => {
    const copy = { ...m } as Record<string, unknown>;
    for (const k of keys) delete copy[k];
    return copy as unknown as Msg;
  });
}

/** Add a default `items` schema to any array sub-schema missing one. */
function ensureArrayItems(node: unknown): void {
  if (Array.isArray(node)) {
    node.forEach((n) => ensureArrayItems(n));
    return;
  }
  if (node && typeof node === 'object') {
    const obj = node as Record<string, unknown>;
    if (obj.type === 'array' && obj.items === undefined) obj.items = { type: 'string' };
    for (const v of Object.values(obj)) ensureArrayItems(v);
  }
}

/** Drop oversized inline content parts (huge base64 data URLs) — semantic. */
function dropOversized(messages: Msg[], maxBytes: number): Msg[] {
  return messages.map((m) => {
    if (!Array.isArray(m.content)) return m;
    const content = (m.content as unknown[]).filter(
      (part) => JSON.stringify(part ?? '').length <= maxBytes,
    );
    return { ...m, content };
  });
}

function stripKeys(tools: unknown[], keys: string[]): void {
  const recurse = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(recurse);
      return;
    }
    if (node && typeof node === 'object') {
      const obj = node as Record<string, unknown>;
      for (const k of keys) delete obj[k];
      for (const v of Object.values(obj)) recurse(v);
    }
  };
  tools.forEach(recurse);
}

function reorder(messages: Msg[], rule: 'alternate' | 'user_first'): Msg[] {
  const system = messages.filter((m) => m.role === 'system');
  const rest = messages.filter((m) => m.role !== 'system');
  if (rule === 'user_first') {
    while (rest.length && rest[0].role !== 'user') rest.shift();
    return [...system, ...rest];
  }
  const alt: Msg[] = [];
  for (const m of rest) {
    if (!alt.length || alt[alt.length - 1].role !== m.role) alt.push(m);
  }
  return [...system, ...alt];
}

function trim(messages: Msg[], strategy: 'drop_oldest' | 'summarize', targetTokens: number): Msg[] {
  const budgetChars = targetTokens * 4;
  const system = messages.filter((m) => m.role === 'system');
  const rest = messages.filter((m) => m.role !== 'system');
  if (strategy === 'summarize' && rest.length > 2) {
    const dropped = rest.slice(0, rest.length - 2);
    const summary: Msg = {
      role: 'system',
      content: `[summary of ${dropped.length} earlier messages]`,
    };
    return [...system, summary, ...rest.slice(-2)];
  }
  const kept: Msg[] = [];
  let size = JSON.stringify(system).length;
  for (let i = rest.length - 1; i >= 0; i--) {
    const c = JSON.stringify(rest[i]).length;
    if (size + c > budgetChars && kept.length) break;
    kept.unshift(rest[i]);
    size += c;
  }
  return [...system, ...kept];
}

function setPath(body: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let cur: Record<string, unknown> = body;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof cur[parts[i]] !== 'object' || cur[parts[i]] === null) cur[parts[i]] = {};
    cur = cur[parts[i]] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = value;
}

/** Redaction-safe diff: scalar before/after + message counts, never content. */
function computeDiff(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  ops: Operation[],
): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const k of keys) {
    if (k === 'messages' || k === 'tools') continue;
    if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) {
      fields[k] = { before: before[k] ?? null, after: after[k] ?? null };
    }
  }
  return {
    operations: ops.map((o) => o.type),
    fields,
    messageCount: {
      before: (before.messages as unknown[])?.length ?? 0,
      after: (after.messages as unknown[])?.length ?? 0,
    },
  };
}
