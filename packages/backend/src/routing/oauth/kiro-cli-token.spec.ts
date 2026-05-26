import { execFile } from 'node:child_process';
import { promises as fs, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  getFreshKiroCliToken,
  getKiroCliTokenCachePath,
  isKiroCliTokenBlob,
  KIRO_CLI_BIN_ENV,
  KIRO_CLI_CACHE_ENV,
  KIRO_CLI_LOGIN_COMMAND,
  parseKiroCliTokenBlob,
  readKiroCliTokenCache,
  serializeKiroCliTokenBlob,
} from './kiro-cli-token';

jest.mock('node:child_process', () => ({
  execFile: jest.fn(),
}));

describe('kiro-cli-token', () => {
  const mockExecFile = execFile as unknown as jest.Mock;

  beforeEach(() => {
    mockExecFile.mockReset();
    delete process.env[KIRO_CLI_BIN_ENV];
    delete process.env[KIRO_CLI_CACHE_ENV];
  });

  afterEach(() => {
    delete process.env[KIRO_CLI_BIN_ENV];
    delete process.env[KIRO_CLI_CACHE_ENV];
  });

  async function writeCache(body: unknown): Promise<string> {
    const dir = await fs.mkdtemp(path.join(tmpdir(), 'kiro-cli-token-'));
    const file = path.join(dir, 'cache.json');
    await fs.writeFile(file, JSON.stringify(body), 'utf8');
    return file;
  }

  it('reads the Kiro CLI token cache as a compact OAuth blob', async () => {
    const file = await writeCache({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: '2026-05-26T08:33:56.027005Z',
      authMethod: 'social',
      provider: 'github',
      profileArn: 'arn:aws:codewhisperer:us-east-1:123456789012:profile/ABC',
    });

    const blob = await readKiroCliTokenCache({ cachePath: file });

    expect(blob).toEqual({
      source: 'kiro-cli',
      t: 'access-token',
      r: 'refresh-token',
      e: Date.parse('2026-05-26T08:33:56.027005Z'),
      authMethod: 'social',
      provider: 'github',
      profileArn: 'arn:aws:codewhisperer:us-east-1:123456789012:profile/ABC',
    });
  });

  it('resolves the default and overridden Kiro CLI cache paths', () => {
    expect(getKiroCliTokenCachePath()).toContain(
      path.join('.aws', 'sso', 'cache', 'kiro-auth-token-cli.json'),
    );

    process.env[KIRO_CLI_CACHE_ENV] = '/tmp/custom-kiro-cache.json';

    expect(getKiroCliTokenCachePath()).toBe('/tmp/custom-kiro-cache.json');
  });

  it('rejects malformed cache files', async () => {
    const file = await writeCache({ refreshToken: 'refresh-token' });

    await expect(readKiroCliTokenCache({ cachePath: file })).rejects.toThrow(
      'Kiro CLI token cache is missing accessToken',
    );
  });

  it('rejects missing cache files with the CLI login command', async () => {
    await expect(
      readKiroCliTokenCache({ cachePath: '/tmp/missing-kiro-cache.json' }),
    ).rejects.toThrow(`Kiro CLI token cache not found. Run \`${KIRO_CLI_LOGIN_COMMAND}\`.`);
  });

  it('parses only Kiro CLI token blobs', () => {
    const blob = {
      source: 'kiro-cli' as const,
      t: 'access-token',
      r: 'refresh-token',
      e: Date.parse('2026-05-26T08:33:56Z'),
    };

    expect(isKiroCliTokenBlob(blob)).toBe(true);
    expect(parseKiroCliTokenBlob(serializeKiroCliTokenBlob(blob))).toEqual(blob);
    expect(parseKiroCliTokenBlob('{"t":"access-token","e":1}')).toBeNull();
    expect(parseKiroCliTokenBlob('not-json')).toBeNull();
  });

  it('returns cached tokens while they are fresh', async () => {
    const file = await writeCache({
      accessToken: 'fresh-access',
      expiresAt: '2026-05-26T08:30:00Z',
    });

    const blob = await getFreshKiroCliToken({
      cachePath: file,
      now: () => Date.parse('2026-05-26T08:00:00Z'),
    });

    expect(blob.t).toBe('fresh-access');
    expect(mockExecFile).not.toHaveBeenCalled();
  });

  it('refreshes expired tokens through the Kiro CLI before reading the cache again', async () => {
    const file = await writeCache({
      accessToken: 'expired-access',
      expiresAt: '2026-05-26T07:59:00Z',
    });
    mockExecFile.mockImplementation(
      (_bin: string, _args: string[], _options: unknown, callback: (err: Error | null) => void) => {
        writeFileSync(
          file,
          JSON.stringify({
            accessToken: 'refreshed-access',
            expiresAt: '2026-05-26T08:30:00Z',
          }),
          'utf8',
        );
        callback(null);
      },
    );

    const blob = await getFreshKiroCliToken({
      cachePath: file,
      cliBin: 'kiro-test',
      now: () => Date.parse('2026-05-26T08:00:00Z'),
    });

    expect(mockExecFile).toHaveBeenCalledWith(
      'kiro-test',
      ['chat', '--list-models', '--format', 'json'],
      expect.objectContaining({
        env: expect.objectContaining({ NO_COLOR: '1', TERM: 'dumb' }),
      }),
      expect.any(Function),
    );
    expect(blob.t).toBe('refreshed-access');
  });

  it('surfaces CLI login guidance when refresh fails', async () => {
    const file = await writeCache({
      accessToken: 'expired-access',
      expiresAt: '2026-05-26T07:59:00Z',
    });
    process.env[KIRO_CLI_BIN_ENV] = 'kiro-from-env';
    mockExecFile.mockImplementation(
      (_bin: string, _args: string[], _options: unknown, callback: (err: Error) => void) => {
        callback(new Error('not logged in'));
      },
    );

    await expect(
      getFreshKiroCliToken({
        cachePath: file,
        now: () => Date.parse('2026-05-26T08:00:00Z'),
      }),
    ).rejects.toThrow(`Kiro CLI is not logged in. Run \`${KIRO_CLI_LOGIN_COMMAND}\`.`);
    expect(mockExecFile.mock.calls[0][0]).toBe('kiro-from-env');
  });
});
