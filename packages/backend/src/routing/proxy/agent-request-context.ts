import type { IncomingHttpHeaders } from 'http';
import { createHash } from 'crypto';

import type { ProxyApiMode } from './proxy-types';

const MAX_FORWARDED_HEADER_COUNT = 64;
const MAX_FORWARDED_VALUE_BYTES = 8 * 1024;
const MAX_FORWARDED_TOTAL_BYTES = 32 * 1024;
const MAX_SESSION_VALUE_BYTES = 512;

const HEADER_NAME_RE = /^[!#$%&'*+.^_`|~0-9a-z-]+$/;

const CLAUDE_SESSION_HEADERS = [
  'x-claude-code-session-id',
  'x-claude-code-agent-id',
  'x-claude-code-parent-agent-id',
] as const;

const CODEX_METADATA_HEADERS = new Set([
  'version',
  'x-codex-beta-features',
  'x-codex-window-id',
  'x-codex-turn-metadata',
  'x-codex-parent-thread-id',
  'x-client-request-id',
  'session-id',
  'thread-id',
  'x-openai-subagent',
  'x-codex-turn-state',
]);

const EXPLICIT_SECRET_HEADERS = new Set([
  'authorization',
  'proxy-authorization',
  'x-api-key',
  'api-key',
  'cookie',
  'set-cookie',
  'chatgpt-account-id',
]);

export type AgentCaller = 'claude-code' | 'codex' | 'unknown';

/**
 * Caller-controlled headers that are safe to consider for a provider request.
 *
 * The maps are deliberately split by protocol family. Consumers must use
 * {@link buildEndpointAwareUpstreamHeaders} rather than merging them directly.
 */
export interface AgentRequestContext {
  caller: AgentCaller;
  anthropicHeaders: Readonly<Record<string, string>>;
  claudeIdentityHeaders: Readonly<Record<string, string>>;
  codexHeaders: Readonly<Record<string, string>>;
}

export interface UpstreamHeaderTarget {
  apiMode: ProxyApiMode;
  endpointKey: string;
  authType?: string;
}

/** Classify a request without treating generic SDK or session headers as proof. */
export function classifyAgentCaller(headers: IncomingHttpHeaders): AgentCaller {
  const userAgent = readHeader(headers, 'user-agent', MAX_FORWARDED_VALUE_BYTES)?.toLowerCase();
  const originator = readHeader(headers, 'originator', MAX_FORWARDED_VALUE_BYTES)?.toLowerCase();
  const anthropicBeta = readHeader(
    headers,
    'anthropic-beta',
    MAX_FORWARDED_VALUE_BYTES,
  )?.toLowerCase();

  const isClaude =
    userAgent?.startsWith('claude-cli/') === true ||
    anthropicBeta?.split(',').some((flag) => flag.trim().startsWith('claude-code-')) === true ||
    CLAUDE_SESSION_HEADERS.some((name) => readHeader(headers, name, 1) != null);

  const isCodex =
    userAgent?.startsWith('codex_cli_rs/') === true ||
    userAgent?.startsWith('codex_exec/') === true ||
    userAgent?.startsWith('codex/') === true ||
    originator?.startsWith('codex_') === true ||
    hasAnyHeader(headers, [
      'x-codex-beta-features',
      'x-codex-window-id',
      'x-codex-turn-metadata',
      'x-codex-parent-thread-id',
      'x-openai-subagent',
      'x-codex-turn-state',
    ]);

  // Conflicting strong signals are treated as untrusted rather than choosing
  // whichever client happens to be checked first.
  if (isClaude === isCodex) return 'unknown';
  return isClaude ? 'claude-code' : 'codex';
}

/**
 * Extract the narrow, non-secret subset of caller headers that may be replayed
 * to a compatible upstream protocol.
 */
export function extractAgentRequestContext(headers: IncomingHttpHeaders): AgentRequestContext {
  const caller = classifyAgentCaller(headers);
  const anthropicHeaders: Record<string, string> = {};
  const claudeIdentityHeaders: Record<string, string> = {};
  const codexHeaders: Record<string, string> = {};
  let count = 0;
  let totalBytes = 0;

  for (const [rawName, rawValue] of Object.entries(headers)) {
    if (count >= MAX_FORWARDED_HEADER_COUNT) break;
    if (rawValue == null) continue;

    const name = rawName.toLowerCase();
    if (!HEADER_NAME_RE.test(name) || isSensitiveHeaderName(name)) continue;

    let target: Record<string, string> | undefined;
    if (name.startsWith('anthropic-')) {
      target = anthropicHeaders;
    } else if (
      caller === 'claude-code' &&
      (name === 'user-agent' || name === 'x-app' || name.startsWith('x-stainless-'))
    ) {
      target = claudeIdentityHeaders;
    } else if (
      caller === 'codex' &&
      (name === 'user-agent' || name === 'originator' || CODEX_METADATA_HEADERS.has(name))
    ) {
      target = codexHeaders;
    }
    if (!target) continue;

    const value = sanitizeForwardedHeaderValue(rawValue, MAX_FORWARDED_VALUE_BYTES);
    if (!value) continue;
    const entryBytes = Buffer.byteLength(name, 'utf8') + Buffer.byteLength(value, 'utf8');
    if (totalBytes + entryBytes > MAX_FORWARDED_TOTAL_BYTES) continue;

    target[name] = value;
    totalBytes += entryBytes;
    count++;
  }

  return { caller, anthropicHeaders, claudeIdentityHeaders, codexHeaders };
}

/**
 * Resolve a stable routing/cache key. Derived coding-client identifiers are
 * hashed because provider hooks may reuse the session key as upstream
 * affinity metadata; raw Claude/Codex session lineage must not cross vendors.
 * An explicit Manifest key remains byte-for-byte compatible with the existing
 * controller behavior.
 */
export function chooseAgentSessionKey(headers: IncomingHttpHeaders): string {
  const explicit = readHeader(headers, 'x-session-key', MAX_SESSION_VALUE_BYTES);
  if (explicit) return explicit;

  const claudeSession = readHeader(headers, 'x-claude-code-session-id', MAX_SESSION_VALUE_BYTES);
  const claudeAgent =
    readHeader(headers, 'x-claude-code-agent-id', MAX_SESSION_VALUE_BYTES) ??
    readHeader(headers, 'x-claude-code-parent-agent-id', MAX_SESSION_VALUE_BYTES);
  if (claudeSession) {
    return opaqueSessionKey('claude', claudeSession, claudeAgent);
  }
  if (claudeAgent) return opaqueSessionKey('claude-agent', claudeAgent);

  const codexSession = readHeader(headers, 'session-id', MAX_SESSION_VALUE_BYTES);
  if (codexSession) return opaqueSessionKey('codex-session', codexSession);
  const codexThread = readHeader(headers, 'thread-id', MAX_SESSION_VALUE_BYTES);
  if (codexThread) return opaqueSessionKey('codex-thread', codexThread);
  const codexRequest = readHeader(headers, 'x-client-request-id', MAX_SESSION_VALUE_BYTES);
  if (codexRequest) return opaqueSessionKey('codex-request', codexRequest);

  return 'default';
}

function opaqueSessionKey(namespace: string, ...values: Array<string | undefined>): string {
  const digest = createHash('sha256')
    .update(namespace)
    .update('\0')
    .update(values.filter((value): value is string => value !== undefined).join('\0'))
    .digest('hex');
  return `${namespace}:${digest}`;
}

/**
 * Merge request context into provider-generated headers only when the incoming
 * and outgoing protocol families match.
 *
 * Caller auth is never present in AgentRequestContext, and any provider auth
 * headers are re-applied last, case-insensitively. This makes stored provider
 * credentials authoritative by construction while allowing current client
 * identity and feature headers to replace stale synthetic values.
 */
export function buildEndpointAwareUpstreamHeaders(
  providerHeaders: Readonly<Record<string, string>>,
  context: AgentRequestContext,
  target: UpstreamHeaderTarget,
): Record<string, string> {
  const result = { ...providerHeaders };

  if (target.apiMode === 'messages' && target.endpointKey === 'anthropic') {
    mergeHeaders(result, context.anthropicHeaders);
    mergeHeaders(result, context.claudeIdentityHeaders);

    const callerBeta = context.anthropicHeaders['anthropic-beta'];
    const providerBeta = getHeader(providerHeaders, 'anthropic-beta');
    const requiredBeta = target.authType === 'subscription' ? 'oauth-2025-04-20' : undefined;
    const mergedBeta = mergeBetaFlags(
      callerBeta,
      callerBeta ? undefined : providerBeta,
      requiredBeta,
    );
    if (mergedBeta) setHeader(result, 'anthropic-beta', mergedBeta);
  } else if (target.apiMode === 'responses' && target.endpointKey === 'openai-subscription') {
    mergeHeaders(result, context.codexHeaders);
  }

  // Provider-created credentials and account routing always win over caller
  // context, even if a future extraction rule becomes too permissive.
  for (const [name, value] of Object.entries(providerHeaders)) {
    if (isSensitiveHeaderName(name.toLowerCase())) setHeader(result, name, value);
  }

  return result;
}

function hasAnyHeader(headers: IncomingHttpHeaders, names: readonly string[]): boolean {
  return names.some((name) => readHeader(headers, name, 1) != null);
}

function readHeader(
  headers: IncomingHttpHeaders,
  requestedName: string,
  maxBytes: number,
): string | undefined {
  const direct = headers[requestedName];
  if (direct != null) return sanitizeHeaderValue(direct, maxBytes);

  // Node lowercases real request headers. The fallback keeps the helper safe
  // and unsurprising for synthetic requests and unit tests.
  const entry = Object.entries(headers).find(([name]) => name.toLowerCase() === requestedName);
  return entry?.[1] == null ? undefined : sanitizeHeaderValue(entry[1], maxBytes);
}

function sanitizeHeaderValue(rawValue: string | string[], maxBytes: number): string | undefined {
  const joined = Array.isArray(rawValue) ? rawValue.join(',') : String(rawValue);
  const cleaned = joined.replace(/[\u0000-\u001f\u007f-\u009f]/g, '').trim();
  if (!cleaned) return undefined;

  const buffer = Buffer.from(cleaned, 'utf8');
  if (buffer.length <= maxBytes) return cleaned;

  let truncated = buffer.subarray(0, maxBytes).toString('utf8');
  while (truncated.endsWith('\uFFFD')) truncated = truncated.slice(0, -1);
  return truncated || undefined;
}

function sanitizeForwardedHeaderValue(
  rawValue: string | string[],
  maxBytes: number,
): string | undefined {
  const joined = Array.isArray(rawValue) ? rawValue.join(',') : String(rawValue);
  const cleaned = joined.replace(/[\u0000-\u001f\u007f-\u009f]/g, '').trim();
  if (!cleaned || Buffer.byteLength(cleaned, 'utf8') > maxBytes) return undefined;
  return cleaned;
}

function isSensitiveHeaderName(name: string): boolean {
  if (EXPLICIT_SECRET_HEADERS.has(name)) return true;
  if (!name.startsWith('anthropic-') && !name.startsWith('x-stainless-')) return false;

  // Keep the Anthropic protocol namespace open-ended while rejecting likely
  // future credential-bearing extensions. Names such as `*-token-count` stay
  // valid because only credential-shaped token names are denied.
  return /(?:^|-)(?:authorization|auth-token|api-key|access-token|refresh-token|session-token|id-token|bearer-token|secret|password|credential|cookie|private-key)(?:-|$)/.test(
    name,
  );
}

function mergeHeaders(
  target: Record<string, string>,
  source: Readonly<Record<string, string>>,
): void {
  for (const [name, value] of Object.entries(source)) setHeader(target, name, value);
}

function setHeader(headers: Record<string, string>, name: string, value: string): void {
  for (const existing of Object.keys(headers)) {
    if (existing.toLowerCase() === name.toLowerCase()) delete headers[existing];
  }
  headers[name] = value;
}

function getHeader(
  headers: Readonly<Record<string, string>>,
  requestedName: string,
): string | undefined {
  return Object.entries(headers).find(([name]) => name.toLowerCase() === requestedName)?.[1];
}

function mergeBetaFlags(...values: Array<string | undefined>): string | undefined {
  const seen = new Set<string>();
  const merged: string[] = [];

  for (const value of values) {
    if (!value) continue;
    for (const rawFlag of value.split(',')) {
      const flag = rawFlag.trim();
      const normalized = flag.toLowerCase();
      if (!flag || seen.has(normalized)) continue;
      seen.add(normalized);
      merged.push(flag);
    }
  }

  return merged.length > 0 ? merged.join(',') : undefined;
}
