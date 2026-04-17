import { ProviderEndpoint } from './provider-endpoints';
import type { ThinkingBlock } from './thinking-block-cache';
import { CallerAttribution } from './caller-classifier';

/**
 * Optional lookup to re-inject cached thought_signature values that were
 * stripped by the client. Called with a tool_call id; returns the cached
 * signature or null.
 */
export type SignatureLookup = (toolCallId: string) => string | null;

/**
 * Optional lookup to re-inject cached Anthropic thinking blocks that were
 * stripped by the client. Called with the first tool_use id from the
 * assistant turn; returns the ordered block sequence or null.
 */
export type ThinkingBlockLookup = (firstToolUseId: string) => ThinkingBlock[] | null;

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
  /** Lookup for re-injecting cached thought_signature values (Google only). */
  signatureLookup?: SignatureLookup;
  /** Lookup for re-injecting cached thinking blocks (Anthropic only). */
  thinkingLookup?: ThinkingBlockLookup;
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
  specificityOverride?: string;
  callerAttribution?: CallerAttribution | null;
}
