export interface MessageRow {
  id: string;
  timestamp: string;
  agent_name: string | null;
  model: string | null;
  provider?: string | null;
  custom_provider_name?: string | null;
  display_name?: string | null;
  routing_tier?: string;
  routing_reason?: string;
  specificity_category?: string;
  header_tier_id?: string;
  header_tier_name?: string;
  header_tier_color?: string;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  cost: number | null;
  status: string;
  error_message?: string | null;
  error_http_status?: number | null;
  /** WHO caused a failure: provider | transport | config | policy | internal. */
  error_origin?: string | null;
  /** WHAT kind of failure it was (rate_limit, auth, no_provider_key, timeout, …). */
  error_class?: string | null;
  auth_type?: string | null;
  fallback_from_model?: string | null;
  fallback_index?: number | null;
  cache_read_tokens?: number | null;
  cache_creation_tokens?: number | null;
  duration_ms?: number | null;
  feedback_rating?: string | null;
  autofix_applied?: boolean;
  autofix_role?: string | null;
}

export function routingTierLabel(tier: string | null | undefined): string | undefined {
  if (!tier) return undefined;
  return tier === 'direct' ? 'DIRECT' : tier;
}

export type MessageColumnKey =
  | 'date'
  | 'message'
  | 'cost'
  | 'totalTokens'
  | 'input'
  | 'output'
  | 'model'
  | 'cache'
  | 'duration'
  | 'status'
  | 'trigger'
  | 'agent';

export const COMPACT_COLUMNS: MessageColumnKey[] = [
  'status',
  'trigger',
  'date',
  'model',
  'message',
  'cost',
  'totalTokens',
  'cache',
  'duration',
];

export const DETAILED_COLUMNS: MessageColumnKey[] = [
  'status',
  'trigger',
  'date',
  'model',
  'message',
  'cost',
  'totalTokens',
  'input',
  'output',
  'cache',
  'duration',
];
