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

export function revokeOpenaiOAuth(agentName: string) {
  return fetchMutate<{ ok: boolean }>(
    `/oauth/openai/revoke?agentName=${encodeURIComponent(agentName)}`,
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
