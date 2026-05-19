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

export function getOpenaiOAuthUrl(agentName: string) {
  return fetchJson<{ url: string }>(`/oauth/openai/authorize`, {
    agentName,
  });
}

export function submitOpenaiOAuthCallback(code: string, state: string) {
  return fetchMutate<{ ok: boolean }>('/oauth/openai/callback', {
    method: 'POST',
    body: JSON.stringify({ code, state }),
    headers: { 'Content-Type': 'application/json' },
  });
}

export function revokeOpenaiOAuth(agentName: string, label?: string) {
  const params = new URLSearchParams({ agentName });
  if (label) params.set('label', label);
  return fetchMutate<{ ok: boolean; notifications?: string[] }>(
    `/oauth/openai/revoke?${params.toString()}`,
    { method: 'POST' },
  );
}

export function startMinimaxOAuth(agentName: string, region: MinimaxOAuthRegion = 'global') {
  return fetchMutate<MinimaxOAuthStartResponse>(
    `/oauth/minimax/start?agentName=${encodeURIComponent(agentName)}&region=${encodeURIComponent(region)}`,
    { method: 'POST' },
  );
}

export function pollMinimaxOAuth(flowId: string) {
  return fetchJson<MinimaxOAuthPollResponse>(`/oauth/minimax/poll`, {
    flowId,
  });
}

export function revokeMinimaxOAuth(agentName: string, label?: string) {
  const params = new URLSearchParams({ agentName });
  if (label) params.set('label', label);
  return fetchMutate<{ ok: boolean; notifications?: string[] }>(
    `/oauth/minimax/revoke?${params.toString()}`,
    { method: 'POST' },
  );
}

export interface AnthropicOAuthAuthorizeResponse {
  url: string;
  state: string;
}

export function startAnthropicOAuth(agentName: string) {
  return fetchMutate<AnthropicOAuthAuthorizeResponse>(
    `/oauth/anthropic/authorize?agentName=${encodeURIComponent(agentName)}`,
    { method: 'POST' },
  );
}

export function submitAnthropicOAuth(agentName: string, payload: string, state: string) {
  return fetchMutate<{ ok: boolean }>(
    `/oauth/anthropic/exchange?agentName=${encodeURIComponent(agentName)}`,
    {
      method: 'POST',
      body: JSON.stringify({ code: payload, state }),
      headers: { 'Content-Type': 'application/json' },
    },
  );
}

export function getAnthropicOAuthPending(agentName: string) {
  return fetchJson<{ state: string | null }>(`/oauth/anthropic/pending`, { agentName });
}

export function revokeAnthropicOAuth(agentName: string, label?: string) {
  const params = new URLSearchParams({ agentName });
  if (label) params.set('label', label);
  return fetchMutate<{ ok: boolean; notifications?: string[] }>(
    `/oauth/anthropic/revoke?${params.toString()}`,
    { method: 'POST' },
  );
}
