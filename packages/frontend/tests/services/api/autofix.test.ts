import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getAutofixCohort, setDevAutofixCohort } from '../../../src/services/api/autofix';

describe('getAutofixCohort', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { location: { origin: 'http://localhost', pathname: '/' } });
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reports eligible for a tenant in the beta cohort', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ eligible: true }),
    } as Response);

    const result = await getAutofixCohort();

    // Hits the tenant-level cohort endpoint with credentials so the session
    // cookie / API key resolves the tenant.
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/autofix/cohort'),
      expect.objectContaining({ credentials: 'include' }),
    );
    expect(result).toEqual({ eligible: true });
  });

  it('reports not eligible for a default tenant outside the cohort', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ eligible: false }),
    } as Response);

    expect(await getAutofixCohort()).toEqual({ eligible: false });
  });

  it('toggles development cohort access', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ eligible: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(setDevAutofixCohort(true)).resolves.toEqual({ eligible: true });
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/autofix/cohort',
      expect.objectContaining({
        method: 'PATCH',
        credentials: 'include',
        body: JSON.stringify({ enabled: true }),
      }),
    );
  });
});
