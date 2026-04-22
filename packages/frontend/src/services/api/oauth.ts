import { fetchJson, fetchMutate } from './core.js';

export type MinimaxOAuthRegion = 'global' | 'cn';

export interface MinimaxOAuthStartResponse {
  flowId: string;
  userCode: string;
  verificationUri: string;
  expiresAt: number;
  pollIntervalMs: number;
}

export interface MinimaxOAuthPollResponse {
  status: 'pending' | 'success' | 'error';
  message?: string;
  pollIntervalMs?: number;
}

export function getOpenaiOAuthUrl(agentName: string, accountLabel?: string) {
  const params: Record<string, string | undefined> = { agentName };
  if (accountLabel) params.accountLabel = accountLabel;
  return fetchJson<{ url: string }>(`/oauth/openai/authorize`, params);
}

export function submitOpenaiOAuthCallback(code: string, state: string) {
  return fetchMutate<{ ok: boolean }>('/oauth/openai/callback', {
    method: 'POST',
    body: JSON.stringify({ code, state }),
    headers: { 'Content-Type': 'application/json' },
  });
}

export function revokeOpenaiOAuth(agentName: string, providerId?: string) {
  const params = new URLSearchParams({ agentName });
  if (providerId) params.set('providerId', providerId);
  return fetchMutate<{ ok: boolean }>(`/oauth/openai/revoke?${params.toString()}`, {
    method: 'POST',
  });
}

export function startMinimaxOAuth(
  agentName: string,
  region: MinimaxOAuthRegion = 'global',
  accountLabel?: string,
) {
  let path = `/oauth/minimax/start?agentName=${encodeURIComponent(agentName)}&region=${encodeURIComponent(region)}`;
  if (accountLabel) path += `&accountLabel=${encodeURIComponent(accountLabel)}`;
  return fetchMutate<MinimaxOAuthStartResponse>(path, { method: 'POST' });
}

export function pollMinimaxOAuth(flowId: string) {
  return fetchJson<MinimaxOAuthPollResponse>(`/oauth/minimax/poll`, {
    flowId,
  });
}
