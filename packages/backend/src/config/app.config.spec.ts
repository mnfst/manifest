describe('appConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  async function loadConfig() {
    const { appConfig } = await import('./app.config');
    return appConfig();
  }

  it('returns default port 3001', async () => {
    delete process.env['PORT'];
    const config = await loadConfig();
    expect(config.port).toBe(3001);
  });

  it('reads PORT from env', async () => {
    process.env['PORT'] = '8080';
    const config = await loadConfig();
    expect(config.port).toBe(8080);
  });

  it('defaults manifestMode to cloud', async () => {
    delete process.env['MANIFEST_MODE'];
    const config = await loadConfig();
    expect(config.manifestMode).toBe('cloud');
  });

  it('reads MANIFEST_MODE from env', async () => {
    process.env['MANIFEST_MODE'] = 'local';
    const config = await loadConfig();
    expect(config.manifestMode).toBe('local');
  });

  it('sanitizes MANIFEST_DB_PATH with path.resolve', async () => {
    process.env['MANIFEST_DB_PATH'] = './relative/../db.sqlite';
    const config = await loadConfig();
    expect(config.dbPath).not.toContain('..');
    expect(config.dbPath).toMatch(/db\.sqlite$/);
  });

  it('returns empty string for empty MANIFEST_DB_PATH', async () => {
    delete process.env['MANIFEST_DB_PATH'];
    const config = await loadConfig();
    expect(config.dbPath).toBe('');
  });

  it('defaults bindAddress to 127.0.0.1', async () => {
    delete process.env['BIND_ADDRESS'];
    const config = await loadConfig();
    expect(config.bindAddress).toBe('127.0.0.1');
  });

  it('defaults throttle settings', async () => {
    delete process.env['THROTTLE_TTL'];
    delete process.env['THROTTLE_LIMIT'];
    const config = await loadConfig();
    expect(config.throttleTtl).toBe(60000);
    expect(config.throttleLimit).toBe(100);
  });

  it('defaults nodeEnv to development when NODE_ENV is not set', async () => {
    delete process.env['NODE_ENV'];
    const config = await loadConfig();
    expect(config.nodeEnv).toBe('development');
  });

  it('reads NODE_ENV from env', async () => {
    process.env['NODE_ENV'] = 'production';
    const config = await loadConfig();
    expect(config.nodeEnv).toBe('production');
  });

  it('defaults dbPoolMax to 20', async () => {
    delete process.env['DB_POOL_MAX'];
    const config = await loadConfig();
    expect(config.dbPoolMax).toBe(20);
  });

  it('reads DB_POOL_MAX from env', async () => {
    process.env['DB_POOL_MAX'] = '50';
    const config = await loadConfig();
    expect(config.dbPoolMax).toBe(50);
  });
});
