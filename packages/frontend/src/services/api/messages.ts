import { fetchJson, fetchMutate } from './core.js';

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
    specificity_category: string | null;
    specificity_miscategorized: boolean;
    auth_type: string | null;
    skill_name: string | null;
    fallback_from_model: string | null;
    fallback_index: number | null;
    session_key: string | null;
    feedback_rating: string | null;
    feedback_tags: string[] | null;
    feedback_details: string | null;
    request_headers: Record<string, string> | null;
    header_tier_id: string | null;
    header_tier_name: string | null;
    header_tier_color: string | null;
    caller_attribution: {
      sdk?: string;
      sdkVersion?: string;
      runtime?: string;
      runtimeVersion?: string;
      os?: string;
      arch?: string;
      userAgent?: string;
      appName?: string;
      appUrl?: string;
      categories?: string[];
    } | null;
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

export function setMessageFeedback(
  id: string,
  body: { rating: 'like' | 'dislike'; tags?: string[]; details?: string },
) {
  return fetchMutate<void>(`/messages/${encodeURIComponent(id)}/feedback`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function clearMessageFeedback(id: string) {
  return fetchMutate<void>(`/messages/${encodeURIComponent(id)}/feedback`, {
    method: 'DELETE',
  });
}

export function flagMessageMiscategorized(id: string) {
  return fetchMutate<void>(`/messages/${encodeURIComponent(id)}/miscategorized`, {
    method: 'PATCH',
  });
}

export function clearMessageMiscategorized(id: string) {
  return fetchMutate<void>(`/messages/${encodeURIComponent(id)}/miscategorized`, {
    method: 'DELETE',
  });
}
