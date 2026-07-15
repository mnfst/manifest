import { generateSeedChains } from './seed-request-chains';

/**
 * Determinism tests for the seed generator. `generateSeedChains` takes its
 * clock as an explicit `now` parameter, so reproducibility is asserted by
 * passing the same anchor twice — no Date.now() mocking required.
 */

const CTX = {
  tenantId: 'seed-tenant-001',
  agentId: 'seed-agent-001',
  agentName: 'demo-agent',
  userId: 'user-1',
};

// A weekday at mid-afternoon UTC: h=0 lands in the busy-hour window (8..22).
const DAY_ANCHOR = new Date('2026-06-02T15:30:00.000Z').getTime();
// A weekday at 04:00 UTC: h=0 lands in the quiet-hour window (0..7).
const NIGHT_ANCHOR = new Date('2026-06-02T04:00:00.000Z').getTime();

describe('generateSeedChains determinism', () => {
  it('produces byte-identical output for the same anchor', () => {
    const run1 = generateSeedChains(CTX, DAY_ANCHOR);
    const run2 = generateSeedChains(CTX, DAY_ANCHOR);

    expect(run1.length).toBe(run2.length);
    // Compare every persisted field. JSON.stringify gives a single failure
    // point with the full diff if anything drifts.
    expect(JSON.stringify(run1)).toBe(JSON.stringify(run2));
  });

  it('produces different but internally consistent output for different anchors', () => {
    const day = generateSeedChains(CTX, DAY_ANCHOR);
    const night = generateSeedChains(CTX, NIGHT_ANCHOR);

    // The 7-day window shifts, so timestamps must differ...
    expect(day[0].request.timestamp).not.toBe(night[0].request.timestamp);
    // ...but both runs keep the request/attempt invariant.
    for (const run of [day, night]) {
      for (const chain of run) {
        for (const attempt of chain.attempts) {
          expect(attempt.request_id).toBe(chain.request.id);
        }
      }
    }
  });

  it('never emits a timestamp beyond the anchor', () => {
    for (const anchor of [DAY_ANCHOR, NIGHT_ANCHOR]) {
      for (const chain of generateSeedChains(CTX, anchor)) {
        for (const row of [chain.request, ...chain.attempts]) {
          expect(new Date(row.timestamp as string).getTime()).toBeLessThanOrEqual(anchor);
        }
      }
    }
  });

  it('keeps every timestamp within the 7-day window anchored at now', () => {
    const lowerBound = DAY_ANCHOR - 7 * 24 * 3600000 - 3600000; // one-hour edge tolerance
    for (const chain of generateSeedChains(CTX, DAY_ANCHOR)) {
      for (const row of [chain.request, ...chain.attempts]) {
        const ts = new Date(row.timestamp as string).getTime();
        expect(ts).toBeGreaterThanOrEqual(lowerBound);
      }
    }
  });

  it('generates fewer requests in the anchor hour on a night anchor than a day anchor', () => {
    const day = generateSeedChains(CTX, DAY_ANCHOR);
    const night = generateSeedChains(CTX, NIGHT_ANCHOR);

    const inAnchorHour = (chains: typeof day, anchor: number) =>
      chains.filter((c) => anchor - new Date(c.request.timestamp as string).getTime() < 3600000)
        .length;

    // The busy-hour branch yields 4..8 requests for h=0, the quiet branch 0..2.
    expect(inAnchorHour(day, DAY_ANCHOR)).toBeGreaterThanOrEqual(inAnchorHour(night, NIGHT_ANCHOR));
  });
});
