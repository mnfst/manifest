import { fetchJson, fetchMutate } from './core.js';

export type MinimaxOAuthRegion = 'global' | 'cn';
export type ProviderConnectionScope = 'agent' | 'global';

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

function scopedQuery(agentName: string, scope?: ProviderConnectionScope) {
  return scope === 'global' ? { scope: 'global' } : { agentName };
}

function scopedParams(agentName: string, scope?: ProviderConnectionScope) {
  const params = new URLSearchParams();
  if (scope === 'global') params.set('scope', 'global');
  else params.set('agentName', agentName);
  return params;
}

export function getOpenaiOAuthUrl(agentName: string, scope?: ProviderConnectionScope) {
  return fetchJson<{ url: string }>(`/oauth/openai/authorize`, scopedQuery(agentName, scope));
}

export function getXaiOAuthUrl(agentName: string, scope?: ProviderConnectionScope) {
  return fetchJson<{ url: string }>(`/oauth/xai/authorize`, scopedQuery(agentName, scope));
}

export function submitOpenaiOAuthCallback(code: string, state: string) {
  return fetchMutate<{ ok: boolean }>('/oauth/openai/callback', {
    method: 'POST',
    body: JSON.stringify({ code, state }),
    headers: { 'Content-Type': 'application/json' },
  });
}

export function submitXaiOAuthCallback(code: string, state: string) {
  return fetchMutate<{ ok: boolean }>('/oauth/xai/callback', {
    method: 'POST',
    body: JSON.stringify({ code, state }),
    headers: { 'Content-Type': 'application/json' },
  });
}

export function revokeOpenaiOAuth(
  agentName: string,
  label?: string,
  scope?: ProviderConnectionScope,
) {
  const params = scopedParams(agentName, scope);
  if (label) params.set('label', label);
  return fetchMutate<{ ok: boolean; notifications?: string[] }>(
    `/oauth/openai/revoke?${params.toString()}`,
    { method: 'POST' },
  );
}

export function revokeXaiOAuth(agentName: string, label?: string, scope?: ProviderConnectionScope) {
  const params = scopedParams(agentName, scope);
  if (label) params.set('label', label);
  return fetchMutate<{ ok: boolean; notifications?: string[] }>(
    `/oauth/xai/revoke?${params.toString()}`,
    { method: 'POST' },
  );
}

export function startMinimaxOAuth(
  agentName: string,
  region: MinimaxOAuthRegion = 'global',
  scope?: ProviderConnectionScope,
) {
  const params = scopedParams(agentName, scope);
  params.set('region', region);
  return fetchMutate<MinimaxOAuthStartResponse>(`/oauth/minimax/start?${params.toString()}`, {
    method: 'POST',
  });
}

export function pollMinimaxOAuth(flowId: string) {
  return fetchJson<MinimaxOAuthPollResponse>(`/oauth/minimax/poll`, {
    flowId,
  });
}

export function revokeMinimaxOAuth(
  agentName: string,
  label?: string,
  scope?: ProviderConnectionScope,
) {
  const params = scopedParams(agentName, scope);
  if (label) params.set('label', label);
  return fetchMutate<{ ok: boolean; notifications?: string[] }>(
    `/oauth/minimax/revoke?${params.toString()}`,
    { method: 'POST' },
  );
}

export function startKiroOAuth(agentName: string, scope?: ProviderConnectionScope) {
  const params = scopedParams(agentName, scope);
  return fetchMutate<MinimaxOAuthStartResponse>(`/oauth/kiro/start?${params.toString()}`, {
    method: 'POST',
  });
}

export function pollKiroOAuth(flowId: string) {
  return fetchJson<MinimaxOAuthPollResponse>(`/oauth/kiro/poll`, { flowId });
}

export function revokeKiroOAuth(
  agentName: string,
  label?: string,
  scope?: ProviderConnectionScope,
) {
  const params = scopedParams(agentName, scope);
  if (label) params.set('label', label);
  return fetchMutate<{ ok: boolean; notifications?: string[] }>(
    `/oauth/kiro/revoke?${params.toString()}`,
    { method: 'POST' },
  );
}

export interface AnthropicOAuthAuthorizeResponse {
  url: string;
  state: string;
}

export function startAnthropicOAuth(agentName: string, scope?: ProviderConnectionScope) {
  const params = scopedParams(agentName, scope);
  return fetchMutate<AnthropicOAuthAuthorizeResponse>(
    `/oauth/anthropic/authorize?${params.toString()}`,
    { method: 'POST' },
  );
}

export function submitAnthropicOAuth(
  agentName: string,
  payload: string,
  state: string,
  scope?: ProviderConnectionScope,
) {
  const params = scopedParams(agentName, scope);
  return fetchMutate<{ ok: boolean }>(`/oauth/anthropic/exchange?${params.toString()}`, {
    method: 'POST',
    body: JSON.stringify({ code: payload, state }),
    headers: { 'Content-Type': 'application/json' },
  });
}

export function getAnthropicOAuthPending(agentName: string, scope?: ProviderConnectionScope) {
  return fetchJson<{ state: string | null }>(
    `/oauth/anthropic/pending`,
    scopedQuery(agentName, scope),
  );
}

export function revokeAnthropicOAuth(
  agentName: string,
  label?: string,
  scope?: ProviderConnectionScope,
) {
  const params = scopedParams(agentName, scope);
  if (label) params.set('label', label);
  return fetchMutate<{ ok: boolean; notifications?: string[] }>(
    `/oauth/anthropic/revoke?${params.toString()}`,
    { method: 'POST' },
  );
}

export function getGeminiOAuthUrl(agentName: string, scope?: ProviderConnectionScope) {
  return fetchJson<{ url: string }>(`/oauth/gemini/authorize`, scopedQuery(agentName, scope));
}

export function submitGeminiOAuthCallback(code: string, state: string) {
  return fetchMutate<{ ok: boolean }>('/oauth/gemini/callback', {
    method: 'POST',
    body: JSON.stringify({ code, state }),
    headers: { 'Content-Type': 'application/json' },
  });
}

export function revokeGeminiOAuth(
  agentName: string,
  label?: string,
  scope?: ProviderConnectionScope,
) {
  const params = scopedParams(agentName, scope);
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
  getUrl: (agentName: string, scope?: ProviderConnectionScope) => Promise<{ url: string }>;
  submitCallback: (code: string, state: string) => Promise<{ ok: boolean }>;
  revoke: (
    agentName: string,
    label?: string,
    scope?: ProviderConnectionScope,
  ) => Promise<{ ok: boolean; notifications?: string[] }>;
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
  xai: {
    getUrl: getXaiOAuthUrl,
    submitCallback: submitXaiOAuthCallback,
    revoke: revokeXaiOAuth,
  },
};

export function getPopupOauthApi(providerId: string): PopupOauthApi {
  const api = POPUP_OAUTH_PROVIDERS[providerId];
  if (!api) {
    throw new Error(`Provider "${providerId}" does not support popup OAuth`);
  }
  return api;
}

/**
 * Dispatch table for device-code providers. DeviceCodeDetailView picks the
 * right start/poll/revoke triplet by provider id. `hasRegion` gates the
 * MiniMax-only region selector — providers without it (e.g. Kiro) ignore the
 * region argument.
 */
export interface DeviceCodeApi {
  start: (
    agentName: string,
    region?: MinimaxOAuthRegion,
    scope?: ProviderConnectionScope,
  ) => Promise<MinimaxOAuthStartResponse>;
  poll: (flowId: string) => Promise<MinimaxOAuthPollResponse>;
  revoke: (
    agentName: string,
    label?: string,
    scope?: ProviderConnectionScope,
  ) => Promise<{ ok: boolean; notifications?: string[] }>;
  hasRegion: boolean;
}

const DEVICE_CODE_PROVIDERS: Record<string, DeviceCodeApi> = {
  minimax: {
    start: (agentName, region, scope) => startMinimaxOAuth(agentName, region ?? 'global', scope),
    poll: pollMinimaxOAuth,
    revoke: revokeMinimaxOAuth,
    hasRegion: true,
  },
  kiro: {
    start: (agentName, _region, scope) => startKiroOAuth(agentName, scope),
    poll: pollKiroOAuth,
    revoke: revokeKiroOAuth,
    hasRegion: false,
  },
};

export function getDeviceCodeApi(providerId: string): DeviceCodeApi {
  const api = DEVICE_CODE_PROVIDERS[providerId];
  if (!api) {
    throw new Error(`Provider "${providerId}" does not support device-code OAuth`);
  }
  return api;
}
