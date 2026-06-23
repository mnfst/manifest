import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getHealingStatus, enableHealing, disableHealing } from '../../src/services/api/routing';

describe('healing api client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const ok = (payload: unknown) =>
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(payload),
      text: () => Promise.resolve(JSON.stringify(payload)),
    } as unknown as Response);

  it('getHealingStatus GETs the per-agent healing endpoint', async () => {
    ok({ enabled: true });
    const result = await getHealingStatus('my agent');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/agents/my%20agent/healing'),
      expect.objectContaining({ credentials: 'include' }),
    );
    expect(result).toEqual({ enabled: true });
  });

  it('enableHealing PUTs to the healing endpoint', async () => {
    ok({ ok: true });
    await enableHealing('a');
    const call = vi.mocked(fetch).mock.calls[0]!;
    expect(call[0]).toContain('/agents/a/healing');
    expect((call[1] as RequestInit).method).toBe('PUT');
  });

  it('disableHealing DELETEs the healing endpoint', async () => {
    ok({ ok: true });
    await disableHealing('a');
    expect((vi.mocked(fetch).mock.calls[0]![1] as RequestInit).method).toBe('DELETE');
  });
});
