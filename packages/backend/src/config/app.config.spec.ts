import { appConfig } from './app.config';

describe('appConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns default values when env vars are not set', () => {
    delete process.env['PORT'];
    delete process.env['NODE_ENV'];
    delete process.env['DATABASE_URL'];
    delete process.env['CORS_ORIGIN'];
    delete process.env['THROTTLE_TTL'];
    delete process.env['THROTTLE_LIMIT'];
    delete process.env['API_KEY'];
    delete process.env['BIND_ADDRESS'];

    const config = appConfig();
    expect(config.port).toBe(3001);
    expect(config.nodeEnv).toBe('development');
    expect(config.databaseUrl).toBe('postgresql://myuser:mypassword@localhost:5432/mydatabase');
    expect(config.corsOrigin).toBe('http://localhost:3000');
    expect(config.throttleTtl).toBe(60000);
    expect(config.throttleLimit).toBe(100);
    expect(config.apiKey).toBe('');
    expect(config.bindAddress).toBe('127.0.0.1');
  });

  it('reads PORT from environment', () => {
    process.env['PORT'] = '4000';
    const config = appConfig();
    expect(config.port).toBe(4000);
  });

  it('reads NODE_ENV from environment', () => {
    process.env['NODE_ENV'] = 'production';
    const config = appConfig();
    expect(config.nodeEnv).toBe('production');
  });

  it('reads DATABASE_URL from environment', () => {
    process.env['DATABASE_URL'] = 'postgresql://user:pass@host:5432/db';
    const config = appConfig();
    expect(config.databaseUrl).toBe('postgresql://user:pass@host:5432/db');
  });

  it('reads CORS_ORIGIN from environment', () => {
    process.env['CORS_ORIGIN'] = 'https://example.com';
    const config = appConfig();
    expect(config.corsOrigin).toBe('https://example.com');
  });

  it('reads API_KEY from environment', () => {
    process.env['API_KEY'] = 'secret-key-123';
    const config = appConfig();
    expect(config.apiKey).toBe('secret-key-123');
  });

  it('reads BIND_ADDRESS from environment', () => {
    process.env['BIND_ADDRESS'] = '0.0.0.0';
    const config = appConfig();
    expect(config.bindAddress).toBe('0.0.0.0');
  });

});
