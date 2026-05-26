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

export interface KiroCliConnectResponse {
  ok: true;
  expiresAt: string;
  authMethod?: string;
  provider?: string;
}

export function connectKiroCliOAuth(agentName: string) {
  return fetchMutate<KiroCliConnectResponse>(
    `/oauth/kiro/cli-connect?agentName=${encodeURIComponent(agentName)}`,
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

export function getGeminiOAuthUrl(agentName: string) {
  return fetchJson<{ url: string }>(`/oauth/gemini/authorize`, {
    agentName,
  });
}

export function submitGeminiOAuthCallback(code: string, state: string) {
  return fetchMutate<{ ok: boolean }>('/oauth/gemini/callback', {
    method: 'POST',
    body: JSON.stringify({ code, state }),
    headers: { 'Content-Type': 'application/json' },
  });
}

export function revokeGeminiOAuth(agentName: string, label?: string) {
  const params = new URLSearchParams({ agentName });
  if (label) params.set('label', label);
  return fetchMutate<{ ok: boolean; notifications?: string[] }>(
    `/oauth/gemini/revoke?${params.toString()}`,
    { method: 'POST' },
  );
}

/**
 * Dispatch table for popup-OAuth providers. The detail view picks the
 * right getUrl/submitCallback/revoke triplet based on the provider id.
 */
export interface PopupOauthApi {
  getUrl: (agentName: string) => Promise<{ url: string }>;
  submitCallback: (code: string, state: string) => Promise<{ ok: boolean }>;
  revoke: (agentName: string, label?: string) => Promise<{ ok: boolean; notifications?: string[] }>;
}

const POPUP_OAUTH_PROVIDERS: Record<string, PopupOauthApi> = {
  openai: {
    getUrl: getOpenaiOAuthUrl,
    submitCallback: submitOpenaiOAuthCallback,
    revoke: revokeOpenaiOAuth,
  },
  gemini: {
    getUrl: getGeminiOAuthUrl,
    submitCallback: submitGeminiOAuthCallback,
    revoke: revokeGeminiOAuth,
  },
};

export function getPopupOauthApi(providerId: string): PopupOauthApi {
  const api = POPUP_OAUTH_PROVIDERS[providerId];
  if (!api) {
    throw new Error(`Provider "${providerId}" does not support popup OAuth`);
  }
  return api;
}
