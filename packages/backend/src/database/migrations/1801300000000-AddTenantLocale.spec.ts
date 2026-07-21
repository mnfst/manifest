import { QueryRunner } from 'typeorm';
import { AddTenantLocale1801300000000 } from './1801300000000-AddTenantLocale';

describe('AddTenantLocale1801300000000', () => {
  const query = jest.fn().mockResolvedValue(undefined);
  const runner = { query } as unknown as QueryRunner;
  const migration = new AddTenantLocale1801300000000();

  beforeEach(() => query.mockClear());

  it('adds an extensible nullable workspace locale', async () => {
    await migration.up(runner);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('ADD COLUMN IF NOT EXISTS "locale"'),
    );
    // Supported locales are validated by the DTO/runtime. Keeping the storage
    // shape generic means a new catalogue does not also require a DB migration.
    expect(query.mock.calls.flat().join(' ')).not.toContain('CHECK');
  });

  it('removes the column on rollback', async () => {
    await migration.down(runner);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('DROP COLUMN IF EXISTS "locale"'));
  });
});
