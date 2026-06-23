/**
 * The deterministic operation catalog — the ONLY things a healing patch may do.
 * This mirrors the Healing service's catalog (the `/heal` API returns these);
 * the applicator below executes them. Dependency-free by design.
 */
export type Operation =
  | { type: 'rename_param'; from: string; to: string }
  | { type: 'drop_param'; param: string }
  | { type: 'clamp_param'; param: string; max: number }
  | { type: 'strip_schema_keys'; keys: string[] }
  | { type: 'remap_model'; from: string; to: string }
  | { type: 'reorder_messages'; rule: 'alternate' | 'user_first' }
  | { type: 'inject_field'; path: string; value: unknown }
  | { type: 'trim_context'; strategy: 'drop_oldest' | 'summarize'; targetTokens: number }
  | { type: 'drop_orphan_tool_messages' }
  | { type: 'strip_message_keys'; keys: string[] }
  | { type: 'ensure_array_items' }
  | { type: 'drop_oversized_content'; maxBytes: number };

export type OperationType = Operation['type'];

/** Every operation type the applicator can execute. Anything else is rejected. */
export const KNOWN_OPERATION_TYPES: ReadonlySet<string> = new Set<OperationType>([
  'rename_param',
  'drop_param',
  'clamp_param',
  'strip_schema_keys',
  'remap_model',
  'reorder_messages',
  'inject_field',
  'trim_context',
  'drop_orphan_tool_messages',
  'strip_message_keys',
  'ensure_array_items',
  'drop_oversized_content',
]);

/** Operations that change request meaning. The Healing service gates these to
 * human review and never auto-activates them; listed here for transparency. */
export const SEMANTIC_OPS: ReadonlySet<string> = new Set([
  'trim_context',
  'drop_oversized_content',
]);

export function riskClassFor(ops: Operation[]): 'auto_safe' | 'semantic' {
  return ops.some((o) => SEMANTIC_OPS.has(o.type)) ? 'semantic' : 'auto_safe';
}

export function isKnownOperationType(type: unknown): type is OperationType {
  return typeof type === 'string' && KNOWN_OPERATION_TYPES.has(type);
}
