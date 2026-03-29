import { fetchJson } from './core.js';

export interface MessageDetailLlmCall {
  id: string;
  call_index: number | null;
  request_model: string | null;
  response_model: string | null;
  gen_ai_system: string | null;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_creation_tokens: number;
  duration_ms: number | null;
  ttft_ms: number | null;
  temperature: number | null;
  max_output_tokens: number | null;
  timestamp: string;
}

export interface MessageDetailToolExecution {
  id: string;
  llm_call_id: string | null;
  tool_name: string;
  duration_ms: number | null;
  status: string;
  error_message: string | null;
}

export interface MessageDetailLog {
  id: string;
  severity: string;
  body: string | null;
  timestamp: string;
  span_id: string | null;
}

export interface MessageDetailResponse {
  message: {
    id: string;
    timestamp: string;
    agent_name: string | null;
    model: string | null;
    status: string;
    error_message: string | null;
    description: string | null;
    service_type: string | null;
    input_tokens: number;
    output_tokens: number;
    cache_read_tokens: number;
    cache_creation_tokens: number;
    cost_usd: number | null;
    duration_ms: number | null;
    trace_id: string | null;
    routing_tier: string | null;
    routing_reason: string | null;
    auth_type: string | null;
    skill_name: string | null;
    fallback_from_model: string | null;
    fallback_index: number | null;
    session_key: string | null;
  };
  llm_calls: MessageDetailLlmCall[];
  tool_executions: MessageDetailToolExecution[];
  agent_logs: MessageDetailLog[];
}

export function getMessages(
  params: {
    range?: string;
    provider?: string;
    service_type?: string;
    cursor?: string;
    limit?: string;
    agent_name?: string;
    cost_min?: string;
    cost_max?: string;
  } = {},
) {
  return fetchJson('/messages', params);
}

export function getMessageDetails(id: string) {
  return fetchJson<MessageDetailResponse>(`/messages/${encodeURIComponent(id)}/details`);
}
