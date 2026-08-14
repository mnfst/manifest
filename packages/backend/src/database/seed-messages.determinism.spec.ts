import { Logger } from '@nestjs/common';
import { seedAgentMessages } from './seed-messages';

/**
 * Determinism-focused tests that pin Date.now() to a fixed value so the seed
 * generator is fully reproducible across runs.
 *
 * Without mocking Date.now(), two consecutive runs of seedAgentMessages can
 * legitimately produce different output because:
 *   1. The msgCount for h=0 depends on `new Date(now).getUTCHours()` and the
 *      runs may straddle an hour boundary.
 *   2. Each timestamp is capped via Math.min(rawTs, now), so a later `now`
 *      shifts the cap and changes the ISO string.
 *   3. The 7-day window is anchored at `now`, so the earliest hour shifts
 *      by the wall-clock delta between runs.
 *
 * Pinning Date.now() removes those sources of drift and lets us assert
 * exact equality across runs and across different anchor timestamps.
 */

function makeMockRepo() {
  return {
    count: jest.fn().mockResolvedValue(0),
    insert: jest.fn().mockResolvedValue({}),
  };
}

function makeMockLogger(): Logger & { log: jest.Mock } {
  return { log: jest.fn() } as unknown as Logger & { log: jest.Mock };
}

function collectInsertedMessages(
  mockRepo: ReturnType<typeof makeMockRepo>,
): Array<Record<string, unknown>> {
  const messages: Array<Record<string, unknown>> = [];
  for (const call of mockRepo.insert.mock.calls) {
    const batch = call[0] as Array<Record<string, unknown>>;
    messages.push(...batch);
  }
  return messages;
}

describe('seedAgentMessages determinism with pinned clock', () => {
  // A weekday at mid-afternoon UTC. Inside the day-window (8..22) so h=0
  // generates the busy-hour msgCount path.
  const DAY_ANCHOR = new Date('2026-06-02T15:30:00.000Z').getTime();
  // A weekday at 04:00 UTC. Inside the night-window (0..7) so h=0 generates
  // the quiet-hour msgCount path. Used to verify the window selection logic.
  const NIGHT_ANCHOR = new Date('2026-06-02T04:00:00.000Z').getTime();
  // A timestamp that exercises the Math.min(rawTs, now) cap at h=0: rawTs
  // can land between now-3500000ms and now-3499999ms, so the cap matters.
  const CAP_ANCHOR = new Date('2026-06-02T12:00:00.000Z').getTime();

  let logger: Logger & { log: jest.Mock };
  let dateNowSpy: jest.SpyInstance;

  beforeEach(() => {
    logger = makeMockLogger();
  });

  afterEach(() => {
    if (dateNowSpy) {
      dateNowSpy.mockRestore();
    }
    jest.clearAllMocks();
  });

  it('produces byte-identical message arrays when Date.now() is pinned', async () => {
    dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(DAY_ANCHOR);

    const repo1 = makeMockRepo();
    await seedAgentMessages(repo1 as never, 'user-1', logger);
    const msgs1 = collectInsertedMessages(repo1);

    const repo2 = makeMockRepo();
    await seedAgentMessages(repo2 as never, 'user-1', logger);
    const msgs2 = collectInsertedMessages(repo2);

    expect(msgs1.length).toBe(msgs2.length);
    // Compare every field that gets persisted. JSON.stringify gives us a
    // single failure point with the full diff if anything drifts.
    expect(JSON.stringify(msgs1)).toBe(JSON.stringify(msgs2));
  });

  it('produces stable timestamps across runs when Date.now() is pinned', async () => {
    dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(DAY_ANCHOR);

    const repo1 = makeMockRepo();
    await seedAgentMessages(repo1 as never, 'user-1', logger);
    const msgs1 = collectInsertedMessages(repo1);

    const repo2 = makeMockRepo();
    await seedAgentMessages(repo2 as never, 'user-1', logger);
    const msgs2 = collectInsertedMessages(repo2);

    for (let i = 0; i < msgs1.length; i++) {
      expect(msgs1[i].timestamp).toBe(msgs2[i].timestamp);
    }
  });

  it('caps timestamps at the pinned now value (no future timestamps)', async () => {
    dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(CAP_ANCHOR);

    const repo = makeMockRepo();
    await seedAgentMessages(repo as never, 'user-1', logger);
    const msgs = collectInsertedMessages(repo);

    // Without the Math.min(rawTs, now) cap, h=0 could produce rawTs values
    // up to ~3.5 minutes in the future. The cap must clamp them to now.
    expect(msgs.length).toBeGreaterThan(0);
    for (const msg of msgs) {
      const ts = new Date(msg.timestamp as string).getTime();
      expect(ts).toBeLessThanOrEqual(CAP_ANCHOR);
    }
  });

  it('keeps every timestamp within the 7-day window anchored at pinned now', async () => {
    dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(DAY_ANCHOR);

    const repo = makeMockRepo();
    await seedAgentMessages(repo as never, 'user-1', logger);
    const msgs = collectInsertedMessages(repo);

    const sevenDaysMs = 7 * 24 * 3600000;
    const lowerBound = DAY_ANCHOR - sevenDaysMs - 3600000; // tolerate one-hour edge
    for (const msg of msgs) {
      const ts = new Date(msg.timestamp as string).getTime();
      expect(ts).toBeGreaterThanOrEqual(lowerBound);
      expect(ts).toBeLessThanOrEqual(DAY_ANCHOR);
    }
  });

  it('uses the busy-hour msgCount path at h=0 when pinned now is a day hour', async () => {
    // DAY_ANCHOR is 15:30 UTC, so utcHour=15 which is within 8..22.
    // The busy-hour branch yields 4..8 messages for h=0. Because hourBase=now
    // at h=0 and rawTs = now + offset, the Math.min(rawTs, now) cap clamps
    // every h=0 message to exactly the ISO string of now.
    dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(DAY_ANCHOR);

    const repo = makeMockRepo();
    await seedAgentMessages(repo as never, 'user-1', logger);
    const msgs = collectInsertedMessages(repo);

    const nowIso = new Date(DAY_ANCHOR).toISOString();
    const h0Messages = msgs.filter((m) => m.timestamp === nowIso);
    // Busy hour produces 4..8 messages (4 + floor(seededRandom(0)*5) ∈ [4,8]).
    expect(h0Messages.length).toBeGreaterThanOrEqual(4);
    expect(h0Messages.length).toBeLessThanOrEqual(8);
  });

  it('uses the quiet-hour msgCount path at h=0 when pinned now is a night hour', async () => {
    // NIGHT_ANCHOR is 04:00 UTC, so utcHour=4 which is within 0..7.
    // The quiet-hour branch yields 0..2 messages for h=0. All h=0 timestamps
    // get capped to exactly the ISO string of now (see test above).
    dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(NIGHT_ANCHOR);

    const repo = makeMockRepo();
    await seedAgentMessages(repo as never, 'user-1', logger);
    const msgs = collectInsertedMessages(repo);

    const nowIso = new Date(NIGHT_ANCHOR).toISOString();
    const h0Messages = msgs.filter((m) => m.timestamp === nowIso);
    // Quiet hour produces 0..2 messages (floor(seededRandom(500)*3) ∈ [0,2]).
    expect(h0Messages.length).toBeLessThanOrEqual(2);
  });

  it('shifts the entire 7-day window when the pinned now changes', async () => {
    dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(DAY_ANCHOR);
    const repoA = makeMockRepo();
    await seedAgentMessages(repoA as never, 'user-1', logger);
    const msgsA = collectInsertedMessages(repoA);

    // Re-pin to one day later. The 7-day window should slide forward by 24h.
    const SHIFTED = DAY_ANCHOR + 24 * 3600000;
    dateNowSpy.mockReturnValue(SHIFTED);
    const repoB = makeMockRepo();
    await seedAgentMessages(repoB as never, 'user-1', logger);
    const msgsB = collectInsertedMessages(repoB);

    expect(msgsA.length).toBeGreaterThan(0);
    expect(msgsB.length).toBeGreaterThan(0);

    const maxA = Math.max(...msgsA.map((m) => new Date(m.timestamp as string).getTime()));
    const maxB = Math.max(...msgsB.map((m) => new Date(m.timestamp as string).getTime()));
    // The latest timestamp in run B should be later than in run A by roughly
    // the 24h shift (allow a generous tolerance for the random offset).
    expect(maxB).toBeGreaterThan(maxA);
    expect(maxB - maxA).toBeGreaterThan(20 * 3600000);
  });

  it('produces deterministic IDs and models independent of pinned now', async () => {
    // The id and model assignments use seededRandom(idx) and idx % models.length;
    // neither depends on `now`. Verify by running with two different anchors.
    dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(DAY_ANCHOR);
    const repoA = makeMockRepo();
    await seedAgentMessages(repoA as never, 'user-1', logger);
    const msgsA = collectInsertedMessages(repoA);

    dateNowSpy.mockReturnValue(NIGHT_ANCHOR);
    const repoB = makeMockRepo();
    await seedAgentMessages(repoB as never, 'user-1', logger);
    const msgsB = collectInsertedMessages(repoB);

    // The total count differs (different msgCount at h=0 across day/night),
    // but where both runs produce a message at the same index, the id and
    // model must match because idx is allocated identically in both runs
    // for matching (h, m) pairs only when msgCounts agree at every h.
    // We can at least assert the first id is 'seed-msg-0001' in both.
    expect(msgsA[0].id).toBe('seed-msg-0001');
    expect(msgsB[0].id).toBe('seed-msg-0001');
    expect(msgsA[0].model).toBe(msgsB[0].model);
  });
});
