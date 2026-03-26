import { ProviderEndpoint } from './provider-endpoints';

/** Options for forwarding a request to a provider via ProviderClient. */
export interface ForwardOptions {
  provider: string;
  apiKey: string;
  model: string;
  body: Record<string, unknown>;
  stream: boolean;
  signal?: AbortSignal;
  extraHeaders?: Record<string, string>;
  customEndpoint?: ProviderEndpoint;
  authType?: string;
}

/** Options for ProxyService.proxyRequest. */
export interface ProxyRequestOptions {
  agentId: string;
  userId: string;
  body: Record<string, unknown>;
  sessionKey: string;
  tenantId?: string;
  agentName?: string;
  signal?: AbortSignal;
}
