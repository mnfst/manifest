import { PricingSyncService } from './pricing-sync.service';

// Edge-case coverage for PricingSyncService that does not fit cleanly into the
// main spec file (which is already long). Split out per the test-file size cap
// in CLAUDE.md. The primary spec is `pricing-sync.service.spec.ts`.

let fetchSpy: jest.SpyInstance;

describe('PricingSyncService edge cases', () => {
  let service: PricingSyncService;

  beforeEach(() => {
    service = new PricingSyncService();
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  describe('refreshCache fetch timeout', () => {
    // The fetch helper sets up `setTimeout(() => controller.abort(), 10_000)`.
    // If anything during the fetch+parse pipeline times out, the abort signal
    // fires and the in-flight fetch/json promise rejects with an AbortError.
    // The catch handler logs and returns null → refreshCache resolves with 0.
    //
    // Without this test, a regression that drops the abort signal (e.g. a
    // refactor that re-fetches without forwarding `controller.signal`) would
    // silently allow the request to hang for the undici default header
    // timeout — exactly the class of bug that motivated the non-blocking
    // startup fix (#1894).
    it('passes the AbortController signal to fetch so it can be aborted on stall', async () => {
      let capturedSignal: AbortSignal | undefined;
      fetchSpy.mockImplementation(async (_url, options) => {
        const init = options as { signal: AbortSignal };
        capturedSignal = init.signal;
        return {
          ok: true,
          json: async () => ({ data: [] }),
        } as unknown as Response;
      });

      await service.refreshCache();

      // The signal must be an AbortSignal so the surrounding setTimeout(abort)
      // can actually terminate a stalled upstream connection. If a refactor
      // dropped the signal, the test fails immediately.
      expect(capturedSignal).toBeInstanceOf(AbortSignal);
      // It should not already be aborted right after a clean request — the
      // timer is cleared in the finally block.
      expect(capturedSignal!.aborted).toBe(false);
    });

    // Simulates a real upstream stall: the signal fires (because the abort
    // timer expired upstream) and res.json() rejects with AbortError. We pin
    // the exact contract that the catch handler:
    //  - returns null from fetchOpenRouterModels
    //  - causes refreshCache to return 0
    //  - logs an error
    //  - does not mutate cache or lastFetchedAt
    it('returns 0 and logs when res.json() rejects with AbortError mid-parse', async () => {
      const abortErr = new Error('The operation was aborted');
      abortErr.name = 'AbortError';
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => {
          throw abortErr;
        },
      } as unknown as Response);

      const loggerSpy = jest.spyOn(service['logger'], 'error').mockImplementation();
      try {
        const count = await service.refreshCache();

        expect(count).toBe(0);
        expect(loggerSpy).toHaveBeenCalledWith(
          expect.stringMatching(/Failed to fetch OpenRouter models.*AbortError/),
        );
        // No cache mutation on abort.
        expect(service.getAll().size).toBe(0);
        expect(service.getLastFetchedAt()).toBeNull();
      } finally {
        loggerSpy.mockRestore();
      }
    });

    // Belt-and-suspenders: if fetch itself rejects with AbortError (network
    // stall *before* headers, not after), refreshCache must still resolve 0
    // and log the error. This guards the other branch of the catch.
    it('returns 0 and logs when fetch itself rejects with AbortError', async () => {
      const abortErr = new Error('The operation was aborted');
      abortErr.name = 'AbortError';
      fetchSpy.mockRejectedValue(abortErr);

      const loggerSpy = jest.spyOn(service['logger'], 'error').mockImplementation();
      try {
        const count = await service.refreshCache();
        expect(count).toBe(0);
        expect(loggerSpy).toHaveBeenCalledWith(
          expect.stringMatching(/Failed to fetch OpenRouter models.*AbortError/),
        );
      } finally {
        loggerSpy.mockRestore();
      }
    });

    // Verify clearTimeout is called on the abort timer regardless of which
    // branch wins (success or thrown). If clearTimeout was moved out of
    // finally and the throw branch leaked the timer, the test below would
    // see a missing call.
    it('clears the abort timer on successful fetch (no leaked handles)', async () => {
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      } as unknown as Response);

      try {
        await service.refreshCache();
        expect(clearTimeoutSpy).toHaveBeenCalled();
      } finally {
        clearTimeoutSpy.mockRestore();
      }
    });

    it('clears the abort timer when fetch throws (no leaked handles)', async () => {
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
      fetchSpy.mockRejectedValue(new Error('network down'));

      const loggerSpy = jest.spyOn(service['logger'], 'error').mockImplementation();
      try {
        const count = await service.refreshCache();
        expect(count).toBe(0);
        expect(clearTimeoutSpy).toHaveBeenCalled();
      } finally {
        loggerSpy.mockRestore();
        clearTimeoutSpy.mockRestore();
      }
    });
  });

  describe('refreshCache concurrency', () => {
    // The service is invoked by both the @Cron decorator (daily) and by
    // manual triggers so concurrent calls are possible. Two parallel calls
    // each compute their own newCache, and the last assignment to
    // `this.cache` wins. This test pins the contract: the final cache is
    // one of the two complete result sets — never a half-merged
    // intermediate. If a future change introduces shared mutable state
    // inside refreshCache, this test will start failing.
    it('handles two parallel refreshCache calls without corrupting the cache', async () => {
      const respA = {
        ok: true,
        json: async () => ({
          data: [{ id: 'openai/gpt-A', pricing: { prompt: '0.001', completion: '0.002' } }],
        }),
      } as unknown as Response;
      const respB = {
        ok: true,
        json: async () => ({
          data: [{ id: 'openai/gpt-B', pricing: { prompt: '0.003', completion: '0.004' } }],
        }),
      } as unknown as Response;

      fetchSpy.mockResolvedValueOnce(respA).mockResolvedValueOnce(respB);

      const [countA, countB] = await Promise.all([service.refreshCache(), service.refreshCache()]);

      expect(countA).toBe(1);
      expect(countB).toBe(1);
      expect(fetchSpy).toHaveBeenCalledTimes(2);

      // Whichever assignment landed last owns the cache. The other entry
      // must not be present, and the cache size must equal the size of one
      // complete fetch (never the union — that would prove the cache was
      // mutated mid-flight).
      const all = service.getAll();
      expect(all.size).toBe(1);
      const hasA = all.has('openai/gpt-A');
      const hasB = all.has('openai/gpt-B');
      expect(hasA !== hasB).toBe(true);
    });

    // When both calls return the same dataset, the result must be identical
    // to a single call. Catches a race where one writer could clear the
    // cache after the other populated it.
    it('is idempotent when called twice in parallel with identical responses', async () => {
      fetchSpy.mockImplementation(
        async () =>
          ({
            ok: true,
            json: async () => ({
              data: [
                { id: 'openai/gpt-4o', pricing: { prompt: '0.001', completion: '0.002' } },
                { id: 'anthropic/claude-x', pricing: { prompt: '0.003', completion: '0.006' } },
              ],
            }),
          }) as unknown as Response,
      );

      const [countA, countB] = await Promise.all([service.refreshCache(), service.refreshCache()]);

      expect(countA).toBe(2);
      expect(countB).toBe(2);

      const all = service.getAll();
      expect(all.size).toBe(2);
      expect(all.has('openai/gpt-4o')).toBe(true);
      expect(all.has('anthropic/claude-x')).toBe(true);
      expect(all.get('openai/gpt-4o')!.input).toBe(0.001);
      expect(all.get('anthropic/claude-x')!.output).toBe(0.006);
    });

    // If one of two concurrent refreshes fails (e.g. transient 503), the
    // other must still populate the cache. The failure must not clobber a
    // successful sibling's writes because the failure branch returns early
    // before assigning this.cache.
    it('does not clobber the cache when a concurrent refresh fails', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ id: 'openai/gpt-good', pricing: { prompt: '0.001', completion: '0.002' } }],
        }),
      } as unknown as Response);
      fetchSpy.mockResolvedValueOnce({ ok: false, status: 503 } as unknown as Response);

      const loggerSpy = jest.spyOn(service['logger'], 'error').mockImplementation();
      try {
        const [countA, countB] = await Promise.all([
          service.refreshCache(),
          service.refreshCache(),
        ]);

        // One call saw the good response (count=1), the other saw 503 (count=0).
        expect(new Set([countA, countB])).toEqual(new Set([0, 1]));

        // The good model must be present regardless of completion order —
        // the 503 branch returns early before reassigning this.cache.
        expect(service.getAll().has('openai/gpt-good')).toBe(true);
        expect(service.getAll().size).toBe(1);
      } finally {
        loggerSpy.mockRestore();
      }
    });
  });
});
