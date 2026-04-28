import { fetchJson, fetchMutate } from './core.js';

export interface NotificationRule {
  id: string;
  agent_name: string;
  metric_type: 'tokens' | 'cost';
  threshold: number;
  period: 'hour' | 'day' | 'week' | 'month';
  action: 'notify' | 'block' | 'both';
  is_active: boolean;
  trigger_count: number;
  created_at: string;
}

export interface NotificationLog {
  id: string;
  sent_at: string;
  actual_value: number;
  threshold_value: number;
  metric_type: 'tokens' | 'cost';
  period_start: string;
  period_end: string;
  agent_name: string;
}

export function getNotificationLogs(agentName: string) {
  return fetchJson<NotificationLog[]>('/notifications/logs', { agent_name: agentName });
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
  return fetchMutate('/notifications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function updateNotificationRule(id: string, data: Record<string, unknown>) {
  return fetchMutate(`/notifications/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function deleteNotificationRule(id: string) {
  return fetchMutate(`/notifications/${encodeURIComponent(id)}`, { method: 'DELETE' });
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
  return fetchMutate('/notifications/email-provider', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function removeEmailProvider() {
  return fetchMutate('/notifications/email-provider', { method: 'DELETE' });
}

export function testEmailProvider(data: {
  provider: string;
  apiKey: string;
  domain?: string;
  to: string;
}) {
  return fetchMutate<{ success: boolean; error?: string }>('/notifications/email-provider/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function testSavedEmailProvider(to: string) {
  return fetchMutate<{ success: boolean; error?: string }>(
    '/notifications/email-provider/test-saved',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to }),
    },
  );
}
