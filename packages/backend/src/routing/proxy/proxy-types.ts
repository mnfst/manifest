import { ProviderEndpoint } from './provider-endpoints';

export interface OpenAIMessage {
  role: string;
  content?: unknown;
  tool_calls?: Array<{
    id: string;
    type: string;
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
  [key: string]: unknown;
}

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
