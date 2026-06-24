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

  it('defaults bindAddress to 127.0.0.1', async () => {
    delete process.env['BIND_ADDRESS'];
    const config = await loadConfig();
    expect(config.bindAddress).toBe('127.0.0.1');
  });

  it('reads BETTER_AUTH_URL from env', async () => {
    process.env['BETTER_AUTH_URL'] = 'https://auth.example.com';
    const config = await loadConfig();
    expect(config.betterAuthUrl).toBe('https://auth.example.com');
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
    process.env['DATABASE_URL'] = 'postgresql://test:test@localhost/test';
    const config = await loadConfig();
    expect(config.nodeEnv).toBe('development');
  });

  it('reads NODE_ENV from env', async () => {
    process.env['NODE_ENV'] = 'production';
    process.env['DATABASE_URL'] = 'postgresql://test:test@localhost/test';
    const config = await loadConfig();
    expect(config.nodeEnv).toBe('production');
  });

  it('defaults dbPoolMax to 30', async () => {
    delete process.env['DB_POOL_MAX'];
    const config = await loadConfig();
    expect(config.dbPoolMax).toBe(30);
  });

  it('reads DB_POOL_MAX from env', async () => {
    process.env['DB_POOL_MAX'] = '50';
    const config = await loadConfig();
    expect(config.dbPoolMax).toBe(50);
  });

  it('defaults dbTuneSession to true when DB_TUNE_SESSION is unset', async () => {
    delete process.env['DB_TUNE_SESSION'];
    const config = await loadConfig();
    expect(config.dbTuneSession).toBe(true);
  });

  it('disables dbTuneSession when DB_TUNE_SESSION is "false"', async () => {
    process.env['DB_TUNE_SESSION'] = 'false';
    const config = await loadConfig();
    expect(config.dbTuneSession).toBe(false);
  });

  it('defaults runMigrationsOnBoot to true when RUN_MIGRATIONS_ON_BOOT is unset', async () => {
    delete process.env['RUN_MIGRATIONS_ON_BOOT'];
    const config = await loadConfig();
    expect(config.runMigrationsOnBoot).toBe(true);
  });

  it('disables runMigrationsOnBoot when RUN_MIGRATIONS_ON_BOOT is "false"', async () => {
    process.env['RUN_MIGRATIONS_ON_BOOT'] = 'false';
    const config = await loadConfig();
    expect(config.runMigrationsOnBoot).toBe(false);
  });

  it('defaults shutdownDrainMs to 10000 when SHUTDOWN_DRAIN_MS is unset', async () => {
    delete process.env['SHUTDOWN_DRAIN_MS'];
    const config = await loadConfig();
    expect(config.shutdownDrainMs).toBe(10000);
  });

  it('reads SHUTDOWN_DRAIN_MS from env', async () => {
    process.env['SHUTDOWN_DRAIN_MS'] = '0';
    const config = await loadConfig();
    expect(config.shutdownDrainMs).toBe(0);
  });

  it('throws when DATABASE_URL is missing in production', async () => {
    delete process.env['DATABASE_URL'];
    process.env['NODE_ENV'] = 'production';
    await expect(loadConfig()).rejects.toThrow('DATABASE_URL is required');
  });

  it('returns default URL when DATABASE_URL is missing in test mode', async () => {
    delete process.env['DATABASE_URL'];
    process.env['NODE_ENV'] = 'test';
    const config = await loadConfig();
    expect(config.databaseUrl).toContain('postgresql://');
  });

  it('reads EMAIL_PROVIDER from env', async () => {
    process.env['EMAIL_PROVIDER'] = 'resend';
    const config = await loadConfig();
    expect(config.emailProvider).toBe('resend');
  });

  it('reads EMAIL_FROM from env', async () => {
    process.env['EMAIL_FROM'] = 'noreply@example.com';
    const config = await loadConfig();
    expect(config.emailFrom).toBe('noreply@example.com');
  });

  it('falls back EMAIL_FROM to NOTIFICATION_FROM_EMAIL', async () => {
    delete process.env['EMAIL_FROM'];
    process.env['NOTIFICATION_FROM_EMAIL'] = 'legacy@example.com';
    const config = await loadConfig();
    expect(config.emailFrom).toBe('legacy@example.com');
  });

  it('defaults emailFrom to noreply@manifest.build', async () => {
    delete process.env['EMAIL_FROM'];
    delete process.env['NOTIFICATION_FROM_EMAIL'];
    const config = await loadConfig();
    expect(config.emailFrom).toBe('noreply@manifest.build');
  });
});
