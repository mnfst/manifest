// Tests that exercise the real PROBE_TIMEOUT_MS (5000ms) abort path inside
// probeModel(). The sibling spec mocks fetch to resolve immediately or to
// reject synchronously, so the AbortController never actually fires — the
// "signal aborts a hung request after 5s" contract is untested there.
//
// Here we use Jest fake timers + a fetch mock that hangs until init.signal
// aborts. Advancing fake time past PROBE_TIMEOUT_MS forces the
// setTimeout(abort, 5000) inside probeModel to run; the listener on the
// mocked fetch observes abort and rejects, simulating real fetch behavior.
// We then verify (1) the signal really aborted, (2) the function returned
// the model (caught error → keep, since transient failures are not
// deterministic subscription rejections), and (3) clearTimeout fires on
// the success path so the abort callback never runs after a clean response.

import { filterBySubscriptionAccess } from './anthropic-subscription-probe';
import { DiscoveredModel } from './model-fetcher';

function makeModel(id: string): DiscoveredModel {
  return {
    id,
    displayName: id,
    provider: 'anthropic',
    contextWindow: 200000,
    inputPricePerToken: null,
    outputPricePerToken: null,
    capabilityReasoning: false,
    capabilityCode: false,
    qualityScore: 3,
  };
}

describe('filterBySubscriptionAccess — real abort/timeout behavior', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
  });

  it('aborts the in-flight fetch after PROBE_TIMEOUT_MS and keeps the model', async () => {
    jest.useFakeTimers();

    const signals: AbortSignal[] = [];
    let aborted = false;
    global.fetch = jest.fn().mockImplementation((_url: string, init: RequestInit) => {
      const sig = init.signal as AbortSignal;
      signals.push(sig);
      // Mirror real fetch: hang forever, then reject with AbortError when
      // the signal aborts. If the setTimeout inside probeModel never fires
      // this promise stays pending and the test would hang past Jest's
      // per-test timeout — a clear failure mode.
      return new Promise((_resolve, reject) => {
        sig.addEventListener('abort', () => {
          aborted = true;
          const err = new Error('The operation was aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    });

    const pending = filterBySubscriptionAccess([makeModel('claude-sonnet-4-6')], 'test-key');

    // Let the fetch call start so the listener is attached before we advance time.
    await Promise.resolve();
    expect(signals).toHaveLength(1);
    expect(signals[0].aborted).toBe(false);
    expect(aborted).toBe(false);

    // Advance just past the 5s probe timeout — setTimeout(abort, 5000) fires.
    await jest.advanceTimersByTimeAsync(5000);

    const result = await pending;
    expect(aborted).toBe(true);
    expect(signals[0].aborted).toBe(true);
    // Caught error path returns true → model is preserved (transient ≠ rejection).
    expect(result.map((m) => m.id)).toEqual(['claude-sonnet-4-6']);
  });

  it('does NOT abort fetch when it resolves before PROBE_TIMEOUT_MS, and clears the timer', async () => {
    jest.useFakeTimers();
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    let observedAbort = false;

    global.fetch = jest.fn().mockImplementation((_url: string, init: RequestInit) => {
      const sig = init.signal as AbortSignal;
      sig.addEventListener('abort', () => {
        observedAbort = true;
      });
      // Resolve immediately on the microtask queue — well before 5s elapses.
      return Promise.resolve({ ok: true, status: 200 });
    });

    const result = await filterBySubscriptionAccess([makeModel('claude-sonnet-4-6')], 'test-key');

    expect(result.map((m) => m.id)).toEqual(['claude-sonnet-4-6']);
    // The success path must clear the abort timer so the queued abort never runs.
    expect(clearTimeoutSpy).toHaveBeenCalled();

    // Push fake time past PROBE_TIMEOUT_MS — if clearTimeout did its job the
    // abort callback never fires and observedAbort stays false. If a future
    // refactor drops the clearTimeout, this assertion catches it.
    await jest.advanceTimersByTimeAsync(10_000);
    expect(observedAbort).toBe(false);

    clearTimeoutSpy.mockRestore();
  });

  it('passes a fresh AbortSignal (not already aborted) to each fetch call', async () => {
    // Each probe must own its own AbortController so one family's timeout
    // never cancels another family's in-flight probe. Without this, slow
    // upstream responses for sonnet could erroneously kill the opus probe.
    const capturedSignals: AbortSignal[] = [];
    global.fetch = jest.fn().mockImplementation((_url: string, init: RequestInit) => {
      capturedSignals.push(init.signal as AbortSignal);
      return Promise.resolve({ ok: true, status: 200 });
    });

    await filterBySubscriptionAccess(
      [makeModel('claude-haiku-4-5-20251001'), makeModel('claude-sonnet-4-6')],
      'test-key',
    );

    expect(capturedSignals).toHaveLength(2);
    expect(capturedSignals[0]).not.toBe(capturedSignals[1]);
    expect(capturedSignals[0].aborted).toBe(false);
    expect(capturedSignals[1].aborted).toBe(false);
  });
});
