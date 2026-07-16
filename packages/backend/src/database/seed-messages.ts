import { Repository } from 'typeorm';
import { Logger } from '@nestjs/common';
import { classifyMessageError, inferProviderFromModel, normalizeStatus } from 'manifest-shared';
import { AgentMessage } from '../entities/agent-message.entity';

/**
 * The model a fallback chain fell back FROM (a premium model that dropped to a
 * cheaper one). Deliberately NOT one of SEED_MODELS, so a seeded row's
 * fallback_from_model never equals the model it actually ran on (which would
 * render an impossible "fell back from X to X").
 */
const SEED_FALLBACK_FROM = 'claude-opus-4-6';

/**
 * Every non-plain-success outcome the seeder draws from, so the demo dashboard
 * shows the FULL taxonomy at a glance — every error origin/class plus the whole
 * fallback story (handled, recovered, and not-handled). error_origin /
 * error_class / superseded are derived from each via the shared
 * classifyMessageError at insert time, exactly like live ingestion.
 */
interface SeedOutcome {
  status: string;
  error_message: string | null;
  error_http_status: number | null;
  routing_reason: string | null;
  fallback_from_model: string | null;
  fallback_index: number | null;
}

const SEED_OUTCOME_SHAPES: SeedOutcome[] = [
  // ── Provider errors: the provider itself threw (origin=provider) ──
  wire(
    'rate_limited',
    429,
    '{"error":{"message":"Rate limit exceeded","type":"rate_limit_error"}}',
    'scored',
  ),
  wire(
    'error',
    500,
    '{"error":{"message":"The server had an error processing your request","code":500}}',
    'scored',
  ),
  wire('error', 401, '{"error":{"message":"Incorrect API key provided","code":401}}', 'default'),
  wire(
    'error',
    400,
    '{"error":{"message":"Invalid request: messages array too long","code":400}}',
    'scored',
  ),
  wire('error', 404, '{"error":{"message":"The model does not exist","code":404}}', 'default'),
  // ── Transport: couldn't reach the provider (origin=transport) ──
  wire('error', 504, 'Upstream provider request timed out', 'scored'),
  wire('error', 503, 'Failed to reach upstream provider: ECONNRESET', 'scored'),
  // ── Manifest setup (origin=config) — hidden from the log by default ──
  wire('error', null, 'Provider API key missing', 'no_provider_key'),
  wire('error', null, 'No providers configured for this agent', 'no_provider'),
  // ── Manifest software limit (origin=policy) — shown, links to the limits page ──
  wire('error', null, 'Usage limit exceeded', 'limit_exceeded'),
  // ── Manifest internal (origin=internal) ──
  wire('error', null, 'Manifest internal error', 'friendly_error'),
  // ── Fallback HANDLED: the attempt failed but was recovered (superseded=true) ──
  fallbackWire(
    'fallback_error',
    529,
    '{"error":{"message":"Overloaded","type":"overloaded_error"}}',
    0,
  ),
  fallbackWire(
    'fallback_error',
    500,
    '{"error":{"message":"The server had an error","code":500}}',
    0,
  ),
  // ── Fallback RECOVERED: the fallback attempt then succeeded (ok, with fallback badge) ──
  {
    status: 'ok',
    error_message: null,
    error_http_status: null,
    routing_reason: 'scored',
    fallback_from_model: SEED_FALLBACK_FROM,
    fallback_index: 1,
  },
  // ── Fallback NOT HANDLED: fell back to another model and still failed (terminal) ──
  fallbackWire('error', 500, '{"error":{"message":"The server had an error","code":500}}', 1),
  fallbackWire(
    'rate_limited',
    429,
    '{"error":{"message":"Rate limit exceeded","type":"rate_limit_error"}}',
    1,
  ),
];

/** A single-shot outcome (no fallback context). */
function wire(status: string, http: number | null, message: string, reason: string): SeedOutcome {
  return {
    status,
    error_message: message,
    error_http_status: http,
    routing_reason: reason,
    fallback_from_model: null,
    fallback_index: null,
  };
}

/** An outcome that carries fallback context (fell back from SEED_FALLBACK_FROM). */
function fallbackWire(
  status: string,
  http: number | null,
  message: string,
  index: number,
): SeedOutcome {
  return {
    status,
    error_message: message,
    error_http_status: http,
    routing_reason: 'scored',
    fallback_from_model: SEED_FALLBACK_FROM,
    fallback_index: index,
  };
}

interface SeedContext {
  tenantId: string;
  agentId: string;
  agentName: string;
}

/** Deterministic pseudo-random for reproducible seed data */
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

/**
 * Models the seeded messages are drawn from. Each distinct (provider,
 * auth_type) pair here becomes one seeded connection (tenant_providers row), so a
 * seeded connection-detail page shows realistic data while a freshly added key
 * — a brand-new tenant_providers id — correctly shows nothing.
 */
const SEED_MODELS: { name: string; auth_type: 'subscription' | 'api_key' }[] = [
  { name: 'claude-sonnet-4-5-20250929', auth_type: 'subscription' },
  { name: 'gpt-4o', auth_type: 'api_key' },
  { name: 'claude-haiku-4-5-20251001', auth_type: 'subscription' },
  { name: 'gemini-2.5-flash', auth_type: 'api_key' },
  { name: 'gpt-4.1', auth_type: 'subscription' },
];

export interface SeedConnection {
  id: string;
  provider: string;
  auth_type: 'subscription' | 'api_key';
}

/** Stable id for a seeded provider connection (tenant_providers row). */
export function seedConnectionId(provider: string, authType: string): string {
  return `seed-conn-${provider}-${authType}`;
}

/**
 * Distinct (provider, auth_type) connections behind the seeded messages. The
 * seeder creates one tenant_providers row per entry and stamps the matching
 * tenant_provider_id on every seeded message, so per-connection analytics resolve
 * against a real connection rather than the legacy provider/auth/label tuple.
 */
export function getSeedConnections(): SeedConnection[] {
  const seen = new Map<string, SeedConnection>();
  for (const m of SEED_MODELS) {
    const provider = inferProviderFromModel(m.name);
    if (!provider) continue;
    const key = `${provider}:${m.auth_type}`;
    if (!seen.has(key)) {
      seen.set(key, {
        id: seedConnectionId(provider, m.auth_type),
        provider,
        auth_type: m.auth_type,
      });
    }
  }
  return [...seen.values()];
}

export async function seedAgentMessages(
  messageRepo: Repository<AgentMessage>,
  userId: string,
  logger: Logger,
  ctx: SeedContext = {
    tenantId: 'seed-tenant-001',
    agentId: 'seed-agent-001',
    agentName: 'demo-agent',
  },
): Promise<void> {
  const count = await messageRepo.count();
  if (count > 0) return;

  const models = SEED_MODELS;
  const now = Date.now();
  const messages: Array<Partial<AgentMessage>> = [];
  let idx = 0;

  // Generate ~4-8 messages per hour over the last 7 days (168 hours)
  for (let h = 168; h >= 0; h--) {
    const hourBase = now - h * 3600000;
    // Fewer messages at night (hours 0-7 UTC), more during work hours
    const utcHour = new Date(hourBase).getUTCHours();
    const msgCount =
      utcHour >= 8 && utcHour <= 22
        ? 4 + Math.floor(seededRandom(h) * 5)
        : Math.floor(seededRandom(h + 500) * 3);

    for (let m = 0; m < msgCount; m++) {
      idx++;
      const entry = models[idx % models.length]!;
      const rawTs = hourBase + Math.floor(seededRandom(idx) * 3500000);
      const ts = new Date(Math.min(rawTs, now)).toISOString();

      // Input tokens 5-25x larger than output (realistic for LLM usage)
      const inputBase = 800 + Math.floor(seededRandom(idx * 3) * 14000);
      const outputBase = 60 + Math.floor(seededRandom(idx * 7) * 1200);
      const cacheRead = Math.floor(seededRandom(idx * 11) * inputBase * 0.4);
      const provider = inferProviderFromModel(entry.name) ?? null;

      // ~15% of rows draw a non-plain-success outcome, cycling through every
      // taxonomy shape so the demo always shows all error origins/classes plus
      // the whole fallback story (handled, recovered, and not-handled). A few of
      // those drawn shapes are themselves successes that were recovered by a
      // fallback, so the true failure rate stays comfortably below the majority.
      const outcome =
        seededRandom(idx * 17) > 0.85
          ? SEED_OUTCOME_SHAPES[idx % SEED_OUTCOME_SHAPES.length]!
          : null;
      const classification = classifyMessageError({
        status: outcome?.status ?? 'ok',
        errorHttpStatus: outcome?.error_http_status ?? null,
        routingReason: outcome?.routing_reason ?? null,
      });

      messages.push({
        id: `seed-msg-${String(idx).padStart(4, '0')}`,
        tenant_id: ctx.tenantId,
        agent_id: ctx.agentId,
        user_id: userId,
        agent_name: ctx.agentName,
        timestamp: ts,
        model: entry.name,
        provider,
        auth_type: entry.auth_type,
        // Link to the seeded connection so the connection-detail page resolves
        // this message by tenant_provider_id (matches getSeedConnections()).
        tenant_provider_id: provider ? seedConnectionId(provider, entry.auth_type) : null,
        input_tokens: inputBase,
        output_tokens: outputBase,
        cache_read_tokens: cacheRead,
        cache_creation_tokens: 0,
        cost_usd:
          entry.auth_type === 'subscription' ? 0 : inputBase * 0.000003 + outputBase * 0.000015,
        duration_ms: 200 + Math.floor(seededRandom(idx * 13) * 4800),
        // Classify from the rich shape above, then store the canonical status —
        // exactly the classify-then-normalize the live recorder does.
        status: normalizeStatus(outcome?.status),
        error_message: outcome?.error_message ?? null,
        error_http_status: outcome?.error_http_status ?? null,
        routing_reason: outcome?.routing_reason ?? null,
        fallback_from_model: outcome?.fallback_from_model ?? null,
        fallback_index: outcome?.fallback_index ?? null,
        error_origin: classification.error_origin,
        error_class: classification.error_class,
        superseded: classification.superseded,
        session_key: `sess-${String((idx % 40) + 1).padStart(3, '0')}`,
      });
    }
  }

  // Bulk insert in batches of 100
  for (let i = 0; i < messages.length; i += 100) {
    await messageRepo.insert(messages.slice(i, i + 100));
  }
  logger.log(`Seeded ${messages.length} agent messages`);
}
