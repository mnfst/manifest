import { QueryRunner } from 'typeorm';
import { AddApiKeyExpiresAt1801700000000 } from './1801700000000-AddApiKeyExpiresAt';

function fakeRunner(): { runner: QueryRunner; queries: string[] } {
  const queries: string[] = [];
  const runner = {
    query: async (sql: string) => {
      queries.push(sql);
    },
  } as unknown as QueryRunner;
  return { runner, queries };
}

describe('AddApiKeyExpiresAt1801700000000', () => {
  it('up adds a nullable expires_at column and resets lock_timeout', async () => {
    const { runner, queries } = fakeRunner();
    await new AddApiKeyExpiresAt1801700000000().up(runner);
    expect(queries.some((q) => q.includes('ADD COLUMN IF NOT EXISTS "expires_at"'))).toBe(true);
    expect(queries[queries.length - 1]).toContain('RESET lock_timeout');
  });

  it('down drops the column and resets lock_timeout', async () => {
    const { runner, queries } = fakeRunner();
    await new AddApiKeyExpiresAt1801700000000().down(runner);
    expect(queries.some((q) => q.includes('DROP COLUMN IF EXISTS "expires_at"'))).toBe(true);
    expect(queries[queries.length - 1]).toContain('RESET lock_timeout');
  });

  it('resets lock_timeout even when the ALTER fails', async () => {
    const runner = {
      query: jest
        .fn()
        .mockResolvedValueOnce(undefined) // SET lock_timeout
        .mockRejectedValueOnce(new Error('boom')) // ALTER
        .mockResolvedValueOnce(undefined), // RESET
    } as unknown as QueryRunner;
    await expect(new AddApiKeyExpiresAt1801700000000().up(runner)).rejects.toThrow('boom');
    expect((runner.query as jest.Mock).mock.calls[2][0]).toContain('RESET lock_timeout');
  });

  it('resets lock_timeout even when the DROP fails', async () => {
    const runner = {
      query: jest
        .fn()
        .mockResolvedValueOnce(undefined) // SET lock_timeout
        .mockRejectedValueOnce(new Error('kaboom')) // DROP
        .mockResolvedValueOnce(undefined), // RESET
    } as unknown as QueryRunner;
    await expect(new AddApiKeyExpiresAt1801700000000().down(runner)).rejects.toThrow('kaboom');
    expect((runner.query as jest.Mock).mock.calls[2][0]).toContain('RESET lock_timeout');
  });
});
