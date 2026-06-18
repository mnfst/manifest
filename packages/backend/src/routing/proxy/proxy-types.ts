import type { IncomingHttpHeaders } from 'http';
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

/**
 * Optional lookup to re-inject cached reasoning_content strings that were
 * stripped by OpenAI-compatible clients. Called with the first tool_call id
 * from the assistant turn; returns the cached reasoning_content or null.
 */
export type ReasoningContentLookup = (firstToolCallId: string) => string | null;

export type ProxyApiMode = 'chat_completions' | 'responses' | 'messages';

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
  chatBody?: Record<string, unknown>;
  apiMode?: ProxyApiMode;
  stream: boolean;
  signal?: AbortSignal;
  extraHeaders?: Record<string, string>;
  customEndpoint?: ProviderEndpoint;
  authType?: string;
  /** Lookup for re-injecting cached thought_signature values (Google only). */
  signatureLookup?: SignatureLookup;
  /** Lookup for re-injecting cached thinking blocks (Anthropic only). */
  thinkingLookup?: ThinkingBlockLookup;
  /** Lookup for re-injecting cached reasoning_content (DeepSeek-compatible providers). */
  reasoningContentLookup?: ReasoningContentLookup;
  /**
   * Provider-specific routing field carried in the OAuth token blob's `u`
   * slot. For Gemini OAuth this is the CodeAssist
   * `cloudaicompanionProject` id assigned during `enrichBlob`.
   */
  providerResource?: string;
}

/** Options for ProxyService.proxyRequest. */
export interface ProxyRequestOptions {
  agentId: string;
  /** Tenant that owns the agent — the scoping key for every provider/key/limit lookup. */
  tenantId: string;
  /**
   * Owning user, when one exists. Informational attribution for the message
   * recorder (`agent_messages.user_id`) only — never used for scoping,
   * keying, or rate limiting.
   */
  userId: string | null;
  body: Record<string, unknown>;
  /** Body used for Manifest-owned routing/scoring/recording; large inline media may be redacted. */
  routingBody?: Record<string, unknown>;
  apiMode?: ProxyApiMode;
  sessionKey: string;
  agentName?: string;
  signal?: AbortSignal;
  specificityOverride?: string;
  callerAttribution?: CallerAttribution | null;
  headers?: IncomingHttpHeaders;
}
