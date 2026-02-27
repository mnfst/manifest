const fetchMock = jest.fn();
(global as unknown as Record<string, unknown>).fetch = fetchMock;

describe('GithubController', () => {
  let controller: InstanceType<
    typeof import('./github.controller').GithubController
  >;

  /** Re-imports the module with fresh module-level cache variables. */
  async function freshImport() {
    const mod = await import('./github.controller');
    return new mod.GithubController();
  }

  beforeEach(async () => {
    jest.resetModules();
    fetchMock.mockReset();
    controller = await freshImport();
  });

  // ── Happy path ────────────────────────────────────────────────

  it('should fetch stars from GitHub API on first call', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ stargazers_count: 42 }),
    });

    const result = await controller.getStars();

    expect(result).toEqual({ stars: 42 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.github.com/repos/mnfst/manifest',
      { headers: { Accept: 'application/vnd.github.v3+json' } },
    );
  });

  it('should return cached stars within TTL without fetching', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ stargazers_count: 100 }),
    });

    // First call populates the cache
    await controller.getStars();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Second call should use the cache
    const result = await controller.getStars();

    expect(result).toEqual({ stars: 100 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('should re-fetch after cache TTL expires', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ stargazers_count: 50 }),
    });

    await controller.getStars();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Advance time past the 10-minute TTL
    const realDateNow = Date.now;
    Date.now = () => realDateNow() + 11 * 60 * 1000;

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ stargazers_count: 75 }),
    });

    const result = await controller.getStars();

    expect(result).toEqual({ stars: 75 });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    Date.now = realDateNow;
  });

  // ── Error handling ────────────────────────────────────────────

  it('should return null when API fails on first call', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 });

    const result = await controller.getStars();

    expect(result).toEqual({ stars: null });
  });

  it('should return stale cache when API fails after previous success', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ stargazers_count: 200 }),
    });
    await controller.getStars();

    // Expire the cache
    const realDateNow = Date.now;
    Date.now = () => realDateNow() + 11 * 60 * 1000;

    fetchMock.mockResolvedValue({ ok: false, status: 503 });

    const result = await controller.getStars();

    expect(result).toEqual({ stars: 200 });

    Date.now = realDateNow;
  });

  it('should return null when fetch throws on first call', async () => {
    fetchMock.mockRejectedValue(new Error('network error'));

    const result = await controller.getStars();

    expect(result).toEqual({ stars: null });
  });

  it('should return stale cache when fetch throws after previous success', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ stargazers_count: 300 }),
    });
    await controller.getStars();

    // Expire the cache
    const realDateNow = Date.now;
    Date.now = () => realDateNow() + 11 * 60 * 1000;

    fetchMock.mockRejectedValue(new Error('timeout'));

    const result = await controller.getStars();

    expect(result).toEqual({ stars: 300 });

    Date.now = realDateNow;
  });

  // ── Edge cases ────────────────────────────────────────────────

  it('should not update cache when stargazers_count is missing', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ some_other_field: 'abc' }),
    });

    const result = await controller.getStars();

    expect(result).toEqual({ stars: null });
  });

  it('should not update cache when stargazers_count is not a number', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ stargazers_count: 'not-a-number' }),
    });

    const result = await controller.getStars();

    expect(result).toEqual({ stars: null });
  });

  it('should update cache when stargazers_count is zero', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ stargazers_count: 0 }),
    });

    const result = await controller.getStars();

    expect(result).toEqual({ stars: 0 });
  });
});
