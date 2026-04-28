export interface MessageRow {
  id: string;
  timestamp: string;
  agent_name: string | null;
  model: string | null;
  provider?: string | null;
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
  auth_type?: string | null;
  fallback_from_model?: string | null;
  fallback_index?: number | null;
  cache_read_tokens?: number | null;
  cache_creation_tokens?: number | null;
  duration_ms?: number | null;
  feedback_rating?: string | null;
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
  | 'feedback';

export const COMPACT_COLUMNS: MessageColumnKey[] = [
  'feedback',
  'date',
  'model',
  'message',
  'cost',
  'totalTokens',
  'status',
];

export const DETAILED_COLUMNS: MessageColumnKey[] = [
  'feedback',
  'date',
  'model',
  'message',
  'cost',
  'totalTokens',
  'input',
  'output',
  'cache',
  'duration',
  'status',
];
