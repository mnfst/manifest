import { toast } from './toast-store.js';

const BASE_URL = '/api/v1';

async function fetchJson<T>(path: string, params?: Record<string, string | undefined>): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`, window.location.origin);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value) url.searchParams.set(key, value);
    }
  }

  const res = await fetch(url.toString(), { credentials: 'include', cache: 'no-store' });
  if (res.status === 401) {
    // Session expired or user logged out — silently redirect to login
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    return new Promise<T>(() => {}); // hang forever, page is redirecting
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(body || `API error: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

async function parseErrorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body.message === 'string') return body.message;
    if (Array.isArray(body.message)) return body.message.join(', ');
  } catch {
    // not JSON — fall through
  }
  return `Request failed (${res.status})`;
}

async function fetchMutate<T = void>(url: string, options: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: 'include', ...options });
  if (!res.ok) {
    const message = await parseErrorMessage(res);
    toast.error(message);
    throw new Error(message);
  }
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export function getAgents() {
  return fetchJson('/agents');
}

export function getOverview(range = '24h', agentName?: string) {
  return fetchJson('/overview', { range, ...(agentName ? { agent_name: agentName } : {}) });
}

export function getTokens(range = '24h', agentName?: string) {
  return fetchJson('/tokens', { range, ...(agentName ? { agent_name: agentName } : {}) });
}

export function getCosts(range = '24h', agentName?: string) {
  return fetchJson('/costs', { range, ...(agentName ? { agent_name: agentName } : {}) });
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

export function getMessageDetails(id: string) {
  return fetchJson<MessageDetailResponse>(`/messages/${encodeURIComponent(id)}/details`);
}

export function getSecurity(range = '24h') {
  return fetchJson('/security', { range });
}

export function getHealth() {
  return fetchJson('/health');
}

export function getAgentKey(agentName: string) {
  return fetchJson<{ keyPrefix: string; apiKey?: string; pluginEndpoint?: string }>(
    `/agents/${encodeURIComponent(agentName)}/key`,
  );
}

export function rotateAgentKey(agentName: string) {
  return fetchMutate<{ apiKey: string }>(
    `${BASE_URL}/agents/${encodeURIComponent(agentName)}/rotate-key`,
    {
      method: 'POST',
    },
  );
}

export function renameAgent(currentName: string, newName: string) {
  return fetchMutate<{ renamed: boolean; name: string }>(
    `${BASE_URL}/agents/${encodeURIComponent(currentName)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName }),
    },
  );
}

export function deleteAgent(agentName: string) {
  return fetchMutate(`${BASE_URL}/agents/${encodeURIComponent(agentName)}`, {
    method: 'DELETE',
  });
}

export function getModelPrices() {
  return fetchJson('/model-prices');
}

export function createAgent(name: string) {
  return fetchMutate<{ agent: { id: string; name: string }; apiKey: string }>(
    `${BASE_URL}/agents`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    },
  );
}

export interface NotificationRule {
  id: string;
  agent_name: string;
  metric_type: 'tokens' | 'cost';
  threshold: number;
  period: 'hour' | 'day' | 'week' | 'month';
  action: 'notify' | 'block' | 'both';
  is_active: boolean | number;
  trigger_count: number;
  created_at: string;
}

export function getNotificationRules(agentName: string) {
  return fetchJson<NotificationRule[]>('/notifications', { agent_name: agentName });
}

export function createNotificationRule(data: {
  agent_name: string;
  metric_type: string;
  threshold: number;
  period: string;
  action?: string;
}) {
  return fetchMutate(`${BASE_URL}/notifications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function updateNotificationRule(id: string, data: Record<string, unknown>) {
  return fetchMutate(`${BASE_URL}/notifications/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function deleteNotificationRule(id: string) {
  return fetchMutate(`${BASE_URL}/notifications/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export interface EmailProviderConfig {
  provider: string;
  domain: string | null;
  keyPrefix: string;
  is_active: boolean;
  notificationEmail: string | null;
}

export async function getEmailProvider(): Promise<EmailProviderConfig | null> {
  const data = await fetchJson<EmailProviderConfig & { configured?: boolean }>(
    '/notifications/email-provider',
  );
  if ('configured' in data && data.configured === false) return null;
  return data;
}

export function setEmailProvider(data: {
  provider: string;
  apiKey?: string;
  domain?: string;
  notificationEmail?: string;
}) {
  return fetchMutate(`${BASE_URL}/notifications/email-provider`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function removeEmailProvider() {
  return fetchMutate(`${BASE_URL}/notifications/email-provider`, {
    method: 'DELETE',
  });
}

export function testEmailProvider(data: {
  provider: string;
  apiKey: string;
  domain?: string;
  to: string;
}) {
  return fetchMutate<{ success: boolean; error?: string }>(
    `${BASE_URL}/notifications/email-provider/test`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    },
  );
}

export function testSavedEmailProvider(to: string) {
  return fetchMutate<{ success: boolean; error?: string }>(
    `${BASE_URL}/notifications/email-provider/test-saved`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to }),
    },
  );
}

export function getNotificationEmailForProvider() {
  return fetchJson<{ email: string | null }>('/notifications/notification-email');
}

export function saveNotificationEmailForProvider(email: string) {
  return fetchMutate<{ saved: boolean }>(`${BASE_URL}/notifications/notification-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
}

/* -- Email Config -- */

export interface EmailConfig {
  configured: boolean;
  provider?: string;
  domain?: string;
  fromEmail?: string;
}

export function getEmailConfig() {
  return fetchJson<EmailConfig>('/email-config');
}

export function saveEmailConfig(data: {
  provider: string;
  apiKey: string;
  domain?: string;
  fromEmail?: string;
}) {
  return fetchMutate(`${BASE_URL}/email-config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function testEmailConfig(
  data: { provider: string; apiKey: string; domain?: string; fromEmail?: string },
  toEmail: string,
) {
  return fetchMutate<{ success: boolean; error?: string }>(`${BASE_URL}/email-config/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...data, toEmail }),
  });
}

export function clearEmailConfig() {
  return fetchMutate(`${BASE_URL}/email-config`, { method: 'DELETE' });
}

export function getNotificationEmail() {
  return fetchJson<{ email: string | null; isDefault: boolean }>('/notification-email');
}

export function saveNotificationEmail(email: string) {
  return fetchMutate(`${BASE_URL}/notification-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
}

/* -- Routing: Status -- */

export function getRoutingStatus(agentName: string) {
  return fetchJson<{ enabled: boolean }>(`/routing/${encodeURIComponent(agentName)}/status`);
}

/* -- Routing: Providers -- */

export type AuthType = 'api_key' | 'subscription';

export interface RoutingProvider {
  id: string;
  provider: string;
  auth_type: AuthType;
  is_active: boolean;
  has_api_key: boolean;
  key_prefix?: string | null;
  connected_at: string;
}

export function getProviders(agentName: string) {
  return fetchJson<RoutingProvider[]>(`/routing/${encodeURIComponent(agentName)}/providers`);
}

export function connectProvider(
  agentName: string,
  data: { provider: string; apiKey?: string; authType?: AuthType },
) {
  return fetchMutate<{ id: string; provider: string; auth_type: AuthType; is_active: boolean }>(
    `${BASE_URL}/routing/${encodeURIComponent(agentName)}/providers`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    },
  );
}

export function deactivateAllProviders(agentName: string) {
  return fetchMutate<{ ok: boolean }>(
    `${BASE_URL}/routing/${encodeURIComponent(agentName)}/providers/deactivate-all`,
    { method: 'POST' },
  );
}

export function disconnectProvider(agentName: string, provider: string, authType?: AuthType) {
  const base = `${BASE_URL}/routing/${encodeURIComponent(agentName)}/providers/${encodeURIComponent(provider)}`;
  const url = authType ? `${base}?authType=${authType}` : base;
  return fetchMutate<{ ok: boolean; notifications: string[] }>(url, { method: 'DELETE' });
}

/* -- Routing: Tier Assignments -- */

export interface TierAssignment {
  id: string;
  agent_id: string;
  tier: string;
  override_model: string | null;
  override_auth_type: AuthType | null;
  auto_assigned_model: string | null;
  fallback_models: string[] | null;
  updated_at: string;
}

export function getTierAssignments(agentName: string) {
  return fetchJson<TierAssignment[]>(`/routing/${encodeURIComponent(agentName)}/tiers`);
}

export function overrideTier(agentName: string, tier: string, model: string, authType?: AuthType) {
  return fetchMutate<TierAssignment>(
    `${BASE_URL}/routing/${encodeURIComponent(agentName)}/tiers/${encodeURIComponent(tier)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, ...(authType && { authType }) }),
    },
  );
}

export function resetTier(agentName: string, tier: string) {
  return fetchMutate(
    `${BASE_URL}/routing/${encodeURIComponent(agentName)}/tiers/${encodeURIComponent(tier)}`,
    {
      method: 'DELETE',
    },
  );
}

export function resetAllTiers(agentName: string) {
  return fetchMutate(`${BASE_URL}/routing/${encodeURIComponent(agentName)}/tiers/reset-all`, {
    method: 'POST',
  });
}

/* -- Routing: Fallbacks -- */

export function getFallbacks(agentName: string, tier: string) {
  return fetchJson<string[]>(
    `/routing/${encodeURIComponent(agentName)}/tiers/${encodeURIComponent(tier)}/fallbacks`,
  );
}

export function setFallbacks(agentName: string, tier: string, models: string[]) {
  return fetchMutate<string[]>(
    `${BASE_URL}/routing/${encodeURIComponent(agentName)}/tiers/${encodeURIComponent(tier)}/fallbacks`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ models }),
    },
  );
}

export function clearFallbacks(agentName: string, tier: string) {
  return fetchMutate(
    `${BASE_URL}/routing/${encodeURIComponent(agentName)}/tiers/${encodeURIComponent(tier)}/fallbacks`,
    { method: 'DELETE' },
  );
}

/* -- Routing: Available Models -- */

export interface AvailableModel {
  model_name: string;
  provider: string;
  input_price_per_token: number | null;
  output_price_per_token: number | null;
  context_window: number;
  capability_reasoning: boolean;
  capability_code: boolean;
  quality_score: number;
  display_name?: string;
  provider_display_name?: string;
}

export function getAvailableModels(agentName: string) {
  return fetchJson<AvailableModel[]>(`/routing/${encodeURIComponent(agentName)}/available-models`);
}

export function refreshModels(agentName: string) {
  return fetchMutate<{ ok: boolean }>(
    `${BASE_URL}/routing/${encodeURIComponent(agentName)}/refresh-models`,
    { method: 'POST' },
  );
}

/* -- Routing: Custom Providers -- */

export interface CustomProviderModel {
  model_name: string;
  input_price_per_million_tokens?: number;
  output_price_per_million_tokens?: number;
  context_window?: number;
}

export interface CustomProviderData {
  id: string;
  name: string;
  base_url: string;
  has_api_key: boolean;
  models: CustomProviderModel[];
  created_at: string;
}

export function getCustomProviders(agentName: string) {
  return fetchJson<CustomProviderData[]>(
    `/routing/${encodeURIComponent(agentName)}/custom-providers`,
  );
}

export function createCustomProvider(
  agentName: string,
  data: {
    name: string;
    base_url: string;
    apiKey?: string;
    models: CustomProviderModel[];
  },
) {
  return fetchMutate<CustomProviderData>(
    `${BASE_URL}/routing/${encodeURIComponent(agentName)}/custom-providers`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    },
  );
}

export function updateCustomProvider(
  agentName: string,
  id: string,
  data: {
    name?: string;
    base_url?: string;
    apiKey?: string;
    models?: CustomProviderModel[];
  },
) {
  return fetchMutate<CustomProviderData>(
    `${BASE_URL}/routing/${encodeURIComponent(agentName)}/custom-providers/${encodeURIComponent(id)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    },
  );
}

export function deleteCustomProvider(agentName: string, id: string) {
  return fetchMutate<{ ok: boolean }>(
    `${BASE_URL}/routing/${encodeURIComponent(agentName)}/custom-providers/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  );
}
