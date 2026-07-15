import { classifyMessageError, inferProviderFromModel } from 'manifest-shared';
import { AgentMessage } from '../entities/agent-message.entity';
import { ManifestRequest } from '../entities/request.entity';

/**
 * Pure generator for the dev seed, request-first.
 *
 * A seeded logical request is one `requests` row plus 0..N linked
 * `provider_attempts` rows, mirroring live ingestion:
 *  - a plain success or terminal provider/transport error is 1 attempt;
 *  - a Manifest-level rejection (config/policy/internal stub) is 0 attempts —
 *    Manifest never reached a provider (see ManifestRequest's entity doc);
 *  - a fallback chain STARTS with a failed attempt on the primary model that
 *    carries NO fallback markers; only subsequent attempts carry
 *    `fallback_from_model` (= the primary) and a 0-based `fallback_index`;
 *  - an Auto-fix flow is failed original(s) (`status='auto_fixed'`,
 *    role `original`) plus the healed retry (role `retry`), sharing an
 *    `autofix_group_id` and carrying the operations + Phoenix references.
 *
 * Everything is derived from `seededRandom(index)` so two runs with the same
 * clock produce byte-identical rows (the determinism spec pins Date.now()).
 */

/** Deterministic pseudo-random for reproducible seed data. */
export function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

/**
 * Models the seeded attempts are drawn from. Each distinct (provider,
 * auth_type) pair becomes one seeded connection (tenant_providers row).
 */
export const SEED_MODELS: { name: string; auth_type: 'subscription' | 'api_key' }[] = [
  { name: 'claude-sonnet-4-5-20250929', auth_type: 'subscription' },
  { name: 'gpt-4o', auth_type: 'api_key' },
  { name: 'claude-haiku-4-5-20251001', auth_type: 'subscription' },
  { name: 'gemini-2.5-flash', auth_type: 'api_key' },
  { name: 'gpt-4.1', auth_type: 'subscription' },
];

/**
 * The premium model a fallback chain starts on (and falls back FROM).
 * Deliberately NOT one of SEED_MODELS so a fallback attempt's
 * `fallback_from_model` never equals the model it ran on.
 */
export const SEED_PRIMARY_MODEL: { name: string; auth_type: 'subscription' | 'api_key' } = {
  name: 'claude-opus-4-6',
  auth_type: 'subscription',
};

/** Stable id for a seeded provider connection (tenant_providers row). */
export function seedConnectionId(provider: string, authType: string): string {
  return `seed-conn-${provider}-${authType}`;
}

export interface SeedChainContext {
  tenantId: string;
  agentId: string;
  agentName: string;
  userId: string;
}

export interface SeedChain {
  request: Partial<ManifestRequest>;
  attempts: Partial<AgentMessage>[];
}

type ChainShape =
  | { kind: 'terminal'; status: 'error' | 'rate_limited'; http: number | null; message: string }
  | { kind: 'stub'; reason: string; message: string }
  | { kind: 'fallback'; hops: 1 | 2; recovered: boolean; terminalStatus?: 'error' | 'rate_limited' }
  | { kind: 'autofix'; originals: 1 | 2; retryOk: boolean };

const OVERLOADED = '{"error":{"message":"Overloaded","type":"overloaded_error"}}';
const SERVER_ERROR =
  '{"error":{"message":"The server had an error processing your request","code":500}}';
const UNSUPPORTED_PARAM =
  '{"error":{"message":"Unsupported parameter: \'max_tokens\' is not supported with this model. Use \'max_completion_tokens\' instead.","type":"invalid_request_error","param":"max_tokens","code":"unsupported_parameter"}}';

/** Every non-plain-success shape the seeder cycles through (full taxonomy). */
const CHAIN_SHAPES: ChainShape[] = [
  // provider errors, terminal on the first attempt
  {
    kind: 'terminal',
    status: 'rate_limited',
    http: 429,
    message: '{"error":{"message":"Rate limit exceeded","type":"rate_limit_error"}}',
  },
  { kind: 'terminal', status: 'error', http: 500, message: SERVER_ERROR },
  {
    kind: 'terminal',
    status: 'error',
    http: 401,
    message: '{"error":{"message":"Incorrect API key provided","code":401}}',
  },
  {
    kind: 'terminal',
    status: 'error',
    http: 400,
    message: '{"error":{"message":"Invalid request: messages array too long","code":400}}',
  },
  {
    kind: 'terminal',
    status: 'error',
    http: 404,
    message: '{"error":{"message":"The model does not exist","code":404}}',
  },
  // transport
  { kind: 'terminal', status: 'error', http: 504, message: 'Upstream provider request timed out' },
  {
    kind: 'terminal',
    status: 'error',
    http: 503,
    message: 'Failed to reach upstream provider: ECONNRESET',
  },
  // Manifest stubs: a request rejected before any provider attempt (0 attempts)
  { kind: 'stub', reason: 'no_provider_key', message: 'Provider API key missing' },
  { kind: 'stub', reason: 'no_provider', message: 'No providers configured for this agent' },
  { kind: 'stub', reason: 'limit_exceeded', message: 'Usage limit exceeded' },
  { kind: 'stub', reason: 'friendly_error', message: 'Manifest internal error' },
  // fallback story: recovered, recovered after two failures, and exhausted
  { kind: 'fallback', hops: 1, recovered: true },
  { kind: 'fallback', hops: 2, recovered: true },
  { kind: 'fallback', hops: 1, recovered: false, terminalStatus: 'error' },
  { kind: 'fallback', hops: 2, recovered: false, terminalStatus: 'rate_limited' },
  // Auto-fix story: healed, healed after two originals, and exhausted
  { kind: 'autofix', originals: 1, retryOk: true },
  { kind: 'autofix', originals: 2, retryOk: true },
  { kind: 'autofix', originals: 1, retryOk: false },
];

const AUTOFIX_OPERATIONS = [
  { type: 'rename_param', args: { from: 'max_tokens', to: 'max_completion_tokens' } },
];

/**
 * Realistic captured request headers, in the exact shape the proxy's
 * sanitizeRequestHeaders produces (lowercased keys, sensitive + noise headers
 * already stripped). Seeded so the drawer's "Request headers" tab has data in
 * dev — live rows get theirs from the proxy capture.
 */
const SEED_USER_AGENTS = [
  'openclaw/1.4.2 (darwin; arm64)',
  'node-fetch/3.3.2',
  'python-httpx/0.27.0',
  'manifest-sdk-js/0.9.1',
];

function seedHeaders(reqIdx: number): Record<string, string> {
  return {
    'content-type': 'application/json',
    accept: 'application/json',
    'user-agent': SEED_USER_AGENTS[reqIdx % SEED_USER_AGENTS.length]!,
    'x-manifest-agent': 'demo-agent',
  };
}

/** Model-parameter snapshot for the "Model params" tab (deterministic). */
function seedParams(reqIdx: number): object {
  return {
    temperature: [0.2, 0.7, 1][reqIdx % 3]!,
    top_p: 1,
    max_tokens: [1024, 2048, 4096][reqIdx % 3]!,
    stream: reqIdx % 2 === 0,
  };
}

interface AttemptSpec {
  model: { name: string; auth_type: 'subscription' | 'api_key' };
  status: string;
  http?: number | null;
  message?: string | null;
  reason?: string | null;
  fallbackFrom?: string | null;
  fallbackIndex?: number | null;
  autofix?: { group: string; role: 'original' | 'retry' } | null;
}

function buildAttempt(
  ctx: SeedChainContext,
  reqIdx: number,
  attemptNo: number,
  tsMs: number,
  spec: AttemptSpec,
): Partial<AgentMessage> {
  const seed = reqIdx * 1000 + attemptNo;
  const ok = spec.status === 'ok';
  const inputTokens = 800 + Math.floor(seededRandom(seed * 3) * 14000);
  const outputTokens = ok ? 60 + Math.floor(seededRandom(seed * 7) * 1200) : 0;
  const provider = inferProviderFromModel(spec.model.name) ?? null;
  const classification = classifyMessageError({
    status: spec.status,
    errorHttpStatus: spec.http ?? null,
    routingReason: spec.reason ?? null,
  });
  return {
    id: `seed-msg-${String(reqIdx).padStart(4, '0')}-${attemptNo}`,
    tenant_id: ctx.tenantId,
    agent_id: ctx.agentId,
    user_id: ctx.userId,
    agent_name: ctx.agentName,
    request_id: `seed-req-${String(reqIdx).padStart(4, '0')}`,
    trace_id: `seed-trace-${String(reqIdx).padStart(4, '0')}`,
    timestamp: new Date(tsMs).toISOString(),
    model: spec.model.name,
    provider,
    auth_type: spec.model.auth_type,
    tenant_provider_id: provider ? seedConnectionId(provider, spec.model.auth_type) : null,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cache_read_tokens: ok ? Math.floor(seededRandom(seed * 11) * inputTokens * 0.4) : 0,
    cache_creation_tokens: 0,
    cost_usd:
      spec.model.auth_type === 'subscription'
        ? 0
        : inputTokens * 0.000003 + outputTokens * 0.000015,
    duration_ms: 200 + Math.floor(seededRandom(seed * 13) * 4800),
    status: spec.status,
    error_message: spec.message ?? null,
    error_http_status: spec.http ?? null,
    routing_reason: spec.reason ?? 'scored',
    fallback_from_model: spec.fallbackFrom ?? null,
    fallback_index: spec.fallbackIndex ?? null,
    error_origin: classification.error_origin,
    error_class: classification.error_class,
    superseded: classification.superseded,
    request_headers: seedHeaders(reqIdx),
    request_params: seedParams(reqIdx),
    autofix_applied: spec.autofix != null,
    autofix_group_id: spec.autofix ? spec.autofix.group : null,
    autofix_role: spec.autofix ? spec.autofix.role : null,
    autofix_operations: spec.autofix ? AUTOFIX_OPERATIONS : null,
    autofix_phoenix: spec.autofix
      ? {
          issueId: `seed-phx-issue-${String(reqIdx).padStart(4, '0')}`,
          patchId: `seed-phx-patch-${String(reqIdx).padStart(4, '0')}`,
          healAttemptId: `seed-phx-heal-${String(reqIdx).padStart(4, '0')}`,
          explanation: {
            summary:
              'Renamed max_tokens to max_completion_tokens (the model requires the newer parameter name).',
          },
        }
      : null,
    session_key: `sess-${String((reqIdx % 40) + 1).padStart(3, '0')}`,
  };
}

/** Terminal request row derived from its last attempt, like buildRequestRow. */
function buildRequest(
  ctx: SeedChainContext,
  reqIdx: number,
  terminal: Partial<AgentMessage>,
): Partial<ManifestRequest> {
  return {
    id: `seed-req-${String(reqIdx).padStart(4, '0')}`,
    tenant_id: ctx.tenantId,
    agent_id: ctx.agentId,
    user_id: ctx.userId,
    agent_name: ctx.agentName,
    trace_id: terminal.trace_id ?? `seed-trace-${String(reqIdx).padStart(4, '0')}`,
    session_key: terminal.session_key ?? null,
    timestamp: terminal.timestamp!,
    duration_ms: terminal.duration_ms ?? null,
    status: terminal.status!,
    error_message: terminal.error_message ?? null,
    error_http_status: terminal.error_http_status ?? null,
    error_origin: terminal.error_origin ?? null,
    error_class: terminal.error_class ?? null,
    requested_model: terminal.fallback_from_model ?? terminal.model ?? null,
    request_headers: seedHeaders(reqIdx),
    request_params: seedParams(reqIdx),
  };
}

function buildFallbackChain(
  ctx: SeedChainContext,
  reqIdx: number,
  tsMs: number,
  shape: Extract<ChainShape, { kind: 'fallback' }>,
): SeedChain {
  const primary = SEED_PRIMARY_MODEL;
  const attempts: Partial<AgentMessage>[] = [
    // The primary attempt fails plainly — no fallback markers on the FIRST attempt.
    buildAttempt(ctx, reqIdx, 1, tsMs, {
      model: primary,
      status: 'fallback_error',
      http: 529,
      message: OVERLOADED,
    }),
  ];
  for (let hop = 0; hop < shape.hops; hop++) {
    const isLast = hop === shape.hops - 1;
    const model = SEED_MODELS[(reqIdx + hop) % SEED_MODELS.length];
    const failed = !shape.recovered && isLast;
    const status = failed ? shape.terminalStatus! : isLast ? 'ok' : 'fallback_error';
    attempts.push(
      buildAttempt(ctx, reqIdx, hop + 2, tsMs + (hop + 1) * 1500, {
        model,
        status,
        http: status === 'ok' ? null : status === 'rate_limited' ? 429 : 500,
        message:
          status === 'ok'
            ? null
            : status === 'rate_limited'
              ? '{"error":{"message":"Rate limit exceeded","type":"rate_limit_error"}}'
              : SERVER_ERROR,
        fallbackFrom: primary.name,
        fallbackIndex: hop,
      }),
    );
  }
  return { request: buildRequest(ctx, reqIdx, attempts[attempts.length - 1]), attempts };
}

function buildAutofixChain(
  ctx: SeedChainContext,
  reqIdx: number,
  tsMs: number,
  shape: Extract<ChainShape, { kind: 'autofix' }>,
): SeedChain {
  const model = SEED_MODELS[1]; // gpt-4o: the max_tokens rename case
  const group = `seed-afx-${String(reqIdx).padStart(4, '0')}`;
  const attempts: Partial<AgentMessage>[] = [];
  for (let i = 0; i < shape.originals; i++) {
    attempts.push(
      buildAttempt(ctx, reqIdx, i + 1, tsMs + i * 1000, {
        model,
        status: 'auto_fixed',
        http: 400,
        message: UNSUPPORTED_PARAM,
        autofix: { group, role: 'original' },
      }),
    );
  }
  attempts.push(
    buildAttempt(ctx, reqIdx, shape.originals + 1, tsMs + shape.originals * 1000 + 1500, {
      model,
      status: shape.retryOk ? 'ok' : 'error',
      http: shape.retryOk ? null : 400,
      message: shape.retryOk ? null : UNSUPPORTED_PARAM,
      autofix: { group, role: 'retry' },
    }),
  );
  return { request: buildRequest(ctx, reqIdx, attempts[attempts.length - 1]), attempts };
}

function buildChain(ctx: SeedChainContext, reqIdx: number, tsMs: number): SeedChain {
  const drawShape = seededRandom(reqIdx * 17) > 0.85;
  if (!drawShape) {
    const model = SEED_MODELS[reqIdx % SEED_MODELS.length];
    const attempt = buildAttempt(ctx, reqIdx, 1, tsMs, { model, status: 'ok' });
    return { request: buildRequest(ctx, reqIdx, attempt), attempts: [attempt] };
  }
  const shape = CHAIN_SHAPES[reqIdx % CHAIN_SHAPES.length];
  if (shape.kind === 'fallback') return buildFallbackChain(ctx, reqIdx, tsMs, shape);
  if (shape.kind === 'autofix') return buildAutofixChain(ctx, reqIdx, tsMs, shape);
  const model = SEED_MODELS[reqIdx % SEED_MODELS.length];
  if (shape.kind === 'stub') {
    // Manifest rejected the request before any provider attempt: 0 attempts.
    const surrogate = buildAttempt(ctx, reqIdx, 1, tsMs, {
      model,
      status: 'error',
      http: null,
      message: shape.message,
      reason: shape.reason,
    });
    return { request: buildRequest(ctx, reqIdx, surrogate), attempts: [] };
  }
  const attempt = buildAttempt(ctx, reqIdx, 1, tsMs, {
    model,
    status: shape.status,
    http: shape.http,
    message: shape.message,
  });
  return { request: buildRequest(ctx, reqIdx, attempt), attempts: [attempt] };
}

/**
 * Generate ~4-8 requests per hour over the last 7 days (fewer at night),
 * chains included. Timestamps never exceed `now`.
 */
export function generateSeedChains(ctx: SeedChainContext, now: number): SeedChain[] {
  const chains: SeedChain[] = [];
  let reqIdx = 0;
  for (let h = 168; h >= 0; h--) {
    const hourBase = now - h * 3600000;
    const utcHour = new Date(hourBase).getUTCHours();
    const count =
      utcHour >= 8 && utcHour <= 22
        ? 4 + Math.floor(seededRandom(h) * 5)
        : Math.floor(seededRandom(h + 500) * 3);
    for (let m = 0; m < count; m++) {
      reqIdx++;
      // Chains span up to ~5s; keep the whole chain at or before `now`.
      const rawTs = hourBase + Math.floor(seededRandom(reqIdx) * 3500000);
      chains.push(buildChain(ctx, reqIdx, Math.min(rawTs, now - 6000)));
    }
  }
  return chains;
}
