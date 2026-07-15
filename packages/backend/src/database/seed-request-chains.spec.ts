import { classifyMessageError } from 'manifest-shared';
import {
  generateSeedChains,
  SEED_MODELS,
  SEED_PRIMARY_MODEL,
  seedConnectionId,
  type SeedChain,
} from './seed-request-chains';

const CTX = {
  tenantId: 'seed-tenant-001',
  agentId: 'seed-agent-001',
  agentName: 'demo-agent',
  userId: 'user-1',
};

// A weekday mid-afternoon UTC anchor so hour-window selection is stable.
const NOW = new Date('2026-06-02T15:30:00.000Z').getTime();

describe('generateSeedChains', () => {
  let chains: SeedChain[];
  let attempts: Array<Record<string, unknown>>;

  beforeAll(() => {
    chains = generateSeedChains(CTX, NOW);
    attempts = chains.flatMap((c) => c.attempts) as Array<Record<string, unknown>>;
  });

  it('generates several hundred requests over 7 days', () => {
    expect(chains.length).toBeGreaterThan(200);
    expect(chains.length).toBeLessThan(1500);
  });

  describe('request/attempt coherence (the request model)', () => {
    it('links every attempt to its parent request', () => {
      const requestIds = new Set(chains.map((c) => c.request.id));
      for (const c of chains) {
        for (const a of c.attempts) {
          expect(a.request_id).toBe(c.request.id);
          expect(requestIds.has(a.request_id as string)).toBe(true);
        }
      }
    });

    it('gives every request 0..N attempts, and only Manifest stubs have 0', () => {
      for (const c of chains) {
        if (c.attempts.length === 0) {
          // A request rejected before any provider attempt: Manifest's own error.
          expect(['config', 'policy', 'internal', 'request']).toContain(c.request.error_origin);
        } else {
          expect(c.attempts.length).toBeGreaterThanOrEqual(1);
          expect(c.attempts.length).toBeLessThanOrEqual(4);
        }
      }
    });

    it('spans single- and multi-attempt requests', () => {
      const counts = new Set(chains.map((c) => c.attempts.length));
      expect(counts.has(1)).toBe(true);
      expect(counts.has(2)).toBe(true);
      expect(counts.has(3)).toBe(true);
    });

    it('derives the request terminal fields from its last attempt', () => {
      for (const c of chains.filter((x) => x.attempts.length > 0)) {
        const terminal = c.attempts[c.attempts.length - 1];
        expect(c.request.status).toBe(terminal.status);
        expect(c.request.error_message ?? null).toBe(terminal.error_message ?? null);
        expect(c.request.requested_model).toBe(terminal.fallback_from_model ?? terminal.model);
        expect(c.request.timestamp).toBe(terminal.timestamp);
      }
    });

    it('orders attempts chronologically within a request', () => {
      for (const c of chains) {
        for (let i = 1; i < c.attempts.length; i++) {
          const prev = new Date(c.attempts[i - 1].timestamp as string).getTime();
          const cur = new Date(c.attempts[i].timestamp as string).getTime();
          expect(cur).toBeGreaterThan(prev);
        }
      }
    });
  });

  describe('fallback chains', () => {
    it('NEVER puts fallback markers on the first attempt of a request', () => {
      for (const c of chains.filter((x) => x.attempts.length > 0)) {
        const first = c.attempts[0];
        expect(first.fallback_from_model ?? null).toBeNull();
        expect(first.fallback_index ?? null).toBeNull();
      }
    });

    it('starts every fallback chain with a failed primary attempt', () => {
      for (const c of chains) {
        const fallbackAttempts = c.attempts.filter((a) => a.fallback_from_model);
        if (fallbackAttempts.length === 0) continue;
        const first = c.attempts[0];
        expect(first.model).toBe(SEED_PRIMARY_MODEL.name);
        expect(first.status).toBe('fallback_error');
        expect(first.superseded).toBe(true);
      }
    });

    it('stamps fallback attempts with the primary model and a 0-based contiguous index', () => {
      for (const c of chains) {
        const fallbackAttempts = c.attempts.filter((a) => a.fallback_from_model);
        fallbackAttempts.forEach((a, i) => {
          expect(a.fallback_from_model).toBe(SEED_PRIMARY_MODEL.name);
          expect(a.fallback_from_model).not.toBe(a.model);
          expect(a.fallback_index).toBe(i);
        });
      }
    });

    it('includes recovered chains (terminal ok) and exhausted chains (terminal failure)', () => {
      const chainsWithFallback = chains.filter((c) =>
        c.attempts.some((a) => a.fallback_from_model),
      );
      const recovered = chainsWithFallback.filter((c) => c.request.status === 'ok');
      const exhausted = chainsWithFallback.filter((c) => c.request.status !== 'ok');
      expect(recovered.length).toBeGreaterThan(0);
      expect(exhausted.length).toBeGreaterThan(0);
      // Non-terminal failed attempts of a chain are always superseded.
      for (const c of chainsWithFallback) {
        for (const a of c.attempts.slice(0, -1)) {
          expect(a.superseded).toBe(true);
        }
      }
    });
  });

  describe('Auto-fix chains', () => {
    let autofixChains: SeedChain[];

    beforeAll(() => {
      autofixChains = chains.filter((c) => c.attempts.some((a) => a.autofix_applied));
    });

    it('seeds Auto-fix flows', () => {
      expect(autofixChains.length).toBeGreaterThan(0);
    });

    it('shapes each flow as auto_fixed original(s) + exactly one retry, sharing a group', () => {
      for (const c of autofixChains) {
        const originals = c.attempts.filter((a) => a.autofix_role === 'original');
        const retries = c.attempts.filter((a) => a.autofix_role === 'retry');
        expect(originals.length).toBeGreaterThanOrEqual(1);
        expect(retries.length).toBe(1);
        const group = retries[0].autofix_group_id;
        expect(group).toBeTruthy();
        for (const a of [...originals, ...retries]) {
          expect(a.autofix_group_id).toBe(group);
          expect(a.autofix_applied).toBe(true);
          expect(a.autofix_operations).toBeTruthy();
          expect(a.autofix_phoenix).toBeTruthy();
        }
        for (const o of originals) {
          expect(o.status).toBe('auto_fixed');
          expect(o.superseded).toBe(true);
        }
      }
    });

    it('includes healed retries (ok) and an exhausted retry (error)', () => {
      const healed = autofixChains.filter((c) => c.request.status === 'ok');
      const exhausted = autofixChains.filter((c) => c.request.status === 'error');
      expect(healed.length).toBeGreaterThan(0);
      expect(exhausted.length).toBeGreaterThan(0);
    });
  });

  describe('taxonomy and field validity', () => {
    it('stamps error_origin/error_class/superseded via the shared classifier', () => {
      for (const a of attempts) {
        const expected = classifyMessageError({
          status: a.status as string,
          errorHttpStatus: (a.error_http_status as number | null) ?? null,
          routingReason: (a.routing_reason as string | null) ?? null,
        });
        expect(a.error_origin).toBe(expected.error_origin);
        expect(a.error_class).toBe(expected.error_class);
        expect(a.superseded).toBe(expected.superseded);
      }
    });

    it('spreads failures across provider, transport, config, policy and internal origins', () => {
      const origins = new Set(chains.map((c) => c.request.error_origin).filter(Boolean));
      for (const origin of ['provider', 'transport', 'config', 'policy', 'internal']) {
        expect(origins.has(origin)).toBe(true);
      }
    });

    it('keeps the vast majority of requests successful', () => {
      const ok = chains.filter((c) => c.request.status === 'ok').length;
      expect(ok / chains.length).toBeGreaterThan(0.8);
    });

    it('draws models from the predefined list and stamps the seeded connection', () => {
      const valid = new Set([...SEED_MODELS, SEED_PRIMARY_MODEL].map((m) => m.name));
      for (const a of attempts) {
        expect(valid.has(a.model as string)).toBe(true);
        expect(a.tenant_provider_id).toBe(
          seedConnectionId(a.provider as string, a.auth_type as string),
        );
      }
    });

    it('computes api_key cost from tokens and zero for subscription', () => {
      for (const a of attempts) {
        if (a.auth_type === 'subscription') {
          expect(a.cost_usd).toBe(0);
        } else {
          const expected =
            (a.input_tokens as number) * 0.000003 + (a.output_tokens as number) * 0.000015;
          expect(a.cost_usd as number).toBeCloseTo(expected, 10);
        }
      }
    });

    it('never emits a timestamp in the future and stays within ~7 days', () => {
      const sevenDaysAgo = NOW - 7 * 24 * 3600000 - 3600000;
      for (const c of chains) {
        for (const row of [c.request, ...c.attempts]) {
          const ts = new Date(row.timestamp as string).getTime();
          expect(ts).toBeGreaterThanOrEqual(sevenDaysAgo);
          expect(ts).toBeLessThanOrEqual(NOW);
        }
      }
    });

    it('carries captured headers + model params on every row (Headers/Params tabs)', () => {
      for (const c of chains) {
        for (const row of [c.request, ...c.attempts] as Array<Record<string, unknown>>) {
          const headers = row.request_headers as Record<string, string>;
          const params = row.request_params as Record<string, unknown>;
          expect(headers && Object.keys(headers).length).toBeGreaterThan(0);
          expect(params && Object.keys(params).length).toBeGreaterThan(0);
          // Post-sanitization shape: lowercase keys, no sensitive headers.
          for (const k of Object.keys(headers)) expect(k).toBe(k.toLowerCase());
          expect(headers.authorization).toBeUndefined();
          expect(headers.cookie).toBeUndefined();
        }
      }
    });

    it('uses seed-prefixed, unique ids for requests and attempts', () => {
      const reqIds = chains.map((c) => c.request.id as string);
      const attIds = attempts.map((a) => a.id as string);
      expect(new Set(reqIds).size).toBe(reqIds.length);
      expect(new Set(attIds).size).toBe(attIds.length);
      for (const id of reqIds) expect(id).toMatch(/^seed-req-\d{4}$/);
      for (const id of attIds) expect(id).toMatch(/^seed-msg-\d{4}-\d$/);
    });
  });

  describe('day/night pattern', () => {
    it('generates fewer requests during night hours (0-7 UTC)', () => {
      let night = 0;
      let day = 0;
      for (const c of chains) {
        const hour = new Date(c.request.timestamp as string).getUTCHours();
        if (hour >= 1 && hour <= 6) night++;
        else if (hour >= 9 && hour <= 21) day++;
      }
      expect(day / 13).toBeGreaterThan(night / 6);
    });
  });
});
