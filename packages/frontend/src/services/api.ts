import { toast } from "./toast-store.js";

const BASE_URL = "/api/v1";

async function fetchJson<T>(path: string, params?: Record<string, string | undefined>): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`, window.location.origin);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value) url.searchParams.set(key, value);
    }
  }

  const res = await fetch(url.toString(), { credentials: "include" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(body || `API error: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

async function parseErrorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body.message === "string") return body.message;
    if (Array.isArray(body.message)) return body.message.join(", ");
  } catch {
    // not JSON — fall through
  }
  return `Request failed (${res.status})`;
}

async function fetchMutate<T = void>(url: string, options: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "include", ...options });
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
  return fetchJson("/agents");
}

export function getOverview(range = "24h", agentName?: string) {
  return fetchJson("/overview", { range, ...(agentName ? { agent_name: agentName } : {}) });
}

export function getTokens(range = "24h", agentName?: string) {
  return fetchJson("/tokens", { range, ...(agentName ? { agent_name: agentName } : {}) });
}

export function getCosts(range = "24h", agentName?: string) {
  return fetchJson("/costs", { range, ...(agentName ? { agent_name: agentName } : {}) });
}

export function getMessages(params: {
  range?: string;
  status?: string;
  service_type?: string;
  cursor?: string;
  limit?: string;
  agent_name?: string;
} = {}) {
  return fetchJson("/messages", params);
}

export function getSecurity(range = "24h") {
  return fetchJson("/security", { range });
}

export function getHealth() {
  return fetchJson("/health");
}

export function getAgentKey(agentName: string) {
  return fetchJson<{ keyPrefix: string; pluginEndpoint?: string }>(`/agents/${encodeURIComponent(agentName)}/key`);
}

export function rotateAgentKey(agentName: string) {
  return fetchMutate<{ apiKey: string }>(`${BASE_URL}/agents/${encodeURIComponent(agentName)}/rotate-key`, {
    method: "POST",
  });
}

export function deleteAgent(agentName: string) {
  return fetchMutate(`${BASE_URL}/agents/${encodeURIComponent(agentName)}`, {
    method: "DELETE",
  });
}

export function getModelPrices() {
  return fetchJson("/model-prices");
}

export function createAgent(name: string) {
  return fetchMutate<{ agent: { id: string; name: string }; apiKey: string }>(`${BASE_URL}/agents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
}

export interface NotificationRule {
  id: string;
  agent_name: string;
  metric_type: "tokens" | "cost";
  threshold: number;
  period: "hour" | "day" | "week" | "month";
  is_active: boolean | number;
  trigger_count: number;
  created_at: string;
}

export function getNotificationRules(agentName: string) {
  return fetchJson<NotificationRule[]>("/notifications", { agent_name: agentName });
}

export function createNotificationRule(data: {
  agent_name: string;
  metric_type: string;
  threshold: number;
  period: string;
}) {
  return fetchMutate(`${BASE_URL}/notifications`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export function updateNotificationRule(id: string, data: Record<string, unknown>) {
  return fetchMutate(`${BASE_URL}/notifications/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export function deleteNotificationRule(id: string) {
  return fetchMutate(`${BASE_URL}/notifications/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export interface EmailProviderConfig {
  provider: string;
  domain: string;
  keyPrefix: string;
  is_active: boolean;
}

export async function getEmailProvider(): Promise<EmailProviderConfig | null> {
  const data = await fetchJson<EmailProviderConfig & { configured?: boolean }>("/notifications/email-provider");
  if ('configured' in data && data.configured === false) return null;
  return data;
}

export function setEmailProvider(data: { provider: string; apiKey: string; domain: string }) {
  return fetchMutate(`${BASE_URL}/notifications/email-provider`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export function removeEmailProvider() {
  return fetchMutate(`${BASE_URL}/notifications/email-provider`, {
    method: "DELETE",
  });
}

export function testEmailProvider(data: { provider: string; apiKey: string; domain: string; to: string }) {
  return fetchMutate<{ success: boolean; error?: string }>(`${BASE_URL}/notifications/email-provider/test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export interface EmailConfig {
  configured: boolean;
  provider?: string;
  domain?: string;
  fromEmail?: string;
}

export function getEmailConfig() {
  return fetchJson<EmailConfig>("/email-config");
}

export function saveEmailConfig(data: {
  provider: string;
  apiKey: string;
  domain?: string;
  fromEmail?: string;
}) {
  return fetchMutate(`${BASE_URL}/email-config`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export function testEmailConfig(data: {
  to: string;
  provider: string;
  apiKey: string;
  domain?: string;
  fromEmail?: string;
}) {
  return fetchMutate<{ success: boolean; error?: string }>(`${BASE_URL}/email-config/test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export function clearEmailConfig() {
  return fetchMutate(`${BASE_URL}/email-config`, {
    method: "DELETE",
  });
}

export interface NotificationEmailResponse {
  email: string | null;
  isDefault: boolean;
}

export function getNotificationEmail() {
  return fetchJson<NotificationEmailResponse>("/email-config/notification-email");
}

export function saveNotificationEmail(email: string) {
  return fetchMutate<{ saved: boolean }>(`${BASE_URL}/email-config/notification-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
}
