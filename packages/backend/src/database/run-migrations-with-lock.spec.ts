import { DataSource } from 'typeorm';
import {
  MIGRATION_ADVISORY_LOCK_KEY,
  runMigrationsWithAdvisoryLock,
} from './run-migrations-with-lock';

interface Mocks {
  dataSource: DataSource;
  query: jest.Mock;
  release: jest.Mock;
  connect: jest.Mock;
  runMigrations: jest.Mock;
}

function build(): Mocks {
  const query = jest.fn().mockResolvedValue(undefined);
  const release = jest.fn().mockResolvedValue(undefined);
  const connect = jest.fn().mockResolvedValue(undefined);
  const runMigrations = jest.fn().mockResolvedValue([]);
  const queryRunner = { connect, query, release };
  const dataSource = {
    createQueryRunner: jest.fn(() => queryRunner),
    runMigrations,
  } as unknown as DataSource;
  return { dataSource, query, release, connect, runMigrations };
}

describe('runMigrationsWithAdvisoryLock', () => {
  beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => undefined));
  afterEach(() => jest.restoreAllMocks());

  it('acquires the advisory lock, runs migrations, then unlocks and releases', async () => {
    const m = build();
    await runMigrationsWithAdvisoryLock(m.dataSource);

    expect(m.connect).toHaveBeenCalledTimes(1);
    expect(m.query).toHaveBeenNthCalledWith(1, 'SELECT pg_advisory_lock($1::bigint)', [
      MIGRATION_ADVISORY_LOCK_KEY,
    ]);
    expect(m.runMigrations).toHaveBeenCalledWith({ transaction: 'each' });
    expect(m.query).toHaveBeenNthCalledWith(2, 'SELECT pg_advisory_unlock($1::bigint)', [
      MIGRATION_ADVISORY_LOCK_KEY,
    ]);
    expect(m.release).toHaveBeenCalledTimes(1);

    // lock acquired before migrations; migrations before unlock.
    const lockOrder = m.query.mock.invocationCallOrder[0];
    const runOrder = m.runMigrations.mock.invocationCallOrder[0];
    const unlockOrder = m.query.mock.invocationCallOrder[1];
    expect(lockOrder).toBeLessThan(runOrder);
    expect(runOrder).toBeLessThan(unlockOrder);
  });

  it('still unlocks and releases when runMigrations throws, and rethrows', async () => {
    const m = build();
    m.runMigrations.mockRejectedValueOnce(new Error('migration boom'));

    await expect(runMigrationsWithAdvisoryLock(m.dataSource)).rejects.toThrow('migration boom');
    // lock (1) + unlock (2) both ran; runner released.
    expect(m.query).toHaveBeenCalledTimes(2);
    expect(m.query).toHaveBeenNthCalledWith(2, 'SELECT pg_advisory_unlock($1::bigint)', [
      MIGRATION_ADVISORY_LOCK_KEY,
    ]);
    expect(m.release).toHaveBeenCalledTimes(1);
  });

  it('swallows an unlock failure but still releases the runner', async () => {
    const m = build();
    m.query.mockImplementation((sql: string) =>
      sql.includes('pg_advisory_unlock')
        ? Promise.reject(new Error('unlock failed'))
        : Promise.resolve(undefined),
    );

    await expect(runMigrationsWithAdvisoryLock(m.dataSource)).resolves.toBeUndefined();
    expect(m.release).toHaveBeenCalledTimes(1);
  });

  it('does not attempt unlock if the lock was never acquired, but still releases', async () => {
    const m = build();
    m.query.mockRejectedValueOnce(new Error('lock failed')); // the pg_advisory_lock call

    await expect(runMigrationsWithAdvisoryLock(m.dataSource)).rejects.toThrow('lock failed');
    expect(m.runMigrations).not.toHaveBeenCalled();
    // Only the lock attempt ran — no unlock query.
    expect(m.query).toHaveBeenCalledTimes(1);
    expect(m.release).toHaveBeenCalledTimes(1);
  });
});
