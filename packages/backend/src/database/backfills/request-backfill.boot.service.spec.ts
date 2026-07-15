import { Logger } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { BackfillState } from '../../entities/backfill-state.entity';
import {
  REQUEST_BACKFILL_LOCK_KEY,
  REQUEST_BACKFILL_MAX_LOCK_ATTEMPTS,
  REQUEST_BACKFILL_NAME,
  RequestBackfillBootService,
} from './request-backfill.boot.service';

function makeLock(locked: boolean) {
  return {
    connect: jest.fn(async () => undefined),
    release: jest.fn(async () => undefined),
    query: jest.fn(async (sql: string) =>
      sql.includes('pg_try_advisory_lock') ? [{ locked }] : undefined,
    ),
  };
}

function makeState(completed: boolean) {
  const execute = jest.fn(async () => undefined);
  const orIgnore = jest.fn(() => ({ execute }));
  const values = jest.fn(() => ({ orIgnore }));
  const into = jest.fn(() => ({ values }));
  const insert = jest.fn(() => ({ into }));
  const createQueryBuilder = jest.fn(() => ({ insert }));
  const countBy = jest.fn(async () => (completed ? 1 : 0));
  const repo = { countBy, createQueryBuilder } as unknown as Repository<BackfillState>;
  return { repo, countBy, values, execute };
}

describe('RequestBackfillBootService', () => {
  const originalEnv = process.env['NODE_ENV'];
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env['NODE_ENV'] = originalEnv;
    errorSpy.mockRestore();
  });

  it('does nothing outside production', () => {
    process.env['NODE_ENV'] = 'test';
    const ds = { createQueryRunner: jest.fn() } as unknown as DataSource;
    new RequestBackfillBootService(ds, makeState(false).repo).onApplicationBootstrap();
    expect(ds.createQueryRunner).not.toHaveBeenCalled();
  });

  it('logs a production startup failure without throwing', async () => {
    process.env['NODE_ENV'] = 'production';
    const state = makeState(false);
    state.countBy.mockRejectedValue(new Error('db down'));
    const ds = { createQueryRunner: jest.fn() } as unknown as DataSource;

    new RequestBackfillBootService(ds, state.repo).onApplicationBootstrap();
    await new Promise((resolve) => setImmediate(resolve));

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('post-deploy request backfill failed'),
    );
  });

  it('waits and retries when the shared lock is initially busy', async () => {
    jest.useFakeTimers();
    process.env['NODE_ENV'] = 'production';
    const state = makeState(false);
    state.countBy.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    const lock = makeLock(false);
    const ds = { createQueryRunner: jest.fn(() => lock) } as unknown as DataSource;

    new RequestBackfillBootService(ds, state.repo).onApplicationBootstrap();
    await jest.advanceTimersByTimeAsync(30_000);

    expect(state.countBy).toHaveBeenCalledTimes(2);
    expect(lock.release).toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('stops retrying when the shared lock remains busy', async () => {
    jest.useFakeTimers();
    process.env['NODE_ENV'] = 'production';
    const state = makeState(false);
    const lock = makeLock(false);
    const ds = { createQueryRunner: jest.fn(() => lock) } as unknown as DataSource;

    new RequestBackfillBootService(ds, state.repo).onApplicationBootstrap();
    await jest.advanceTimersByTimeAsync(30_000 * (REQUEST_BACKFILL_MAX_LOCK_ATTEMPTS - 1));

    expect(state.countBy).toHaveBeenCalledTimes(REQUEST_BACKFILL_MAX_LOCK_ATTEMPTS);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('lock stayed busy'));
    jest.useRealTimers();
  });

  it('returns true without taking a lock when already complete', async () => {
    const ds = { createQueryRunner: jest.fn() } as unknown as DataSource;
    const runner = jest.fn();

    await expect(
      new RequestBackfillBootService(ds, makeState(true).repo).runOnce(runner),
    ).resolves.toBe(true);
    expect(ds.createQueryRunner).not.toHaveBeenCalled();
    expect(runner).not.toHaveBeenCalled();
  });

  it('returns false and releases its connection when the shared lock is busy', async () => {
    const lock = makeLock(false);
    const ds = { createQueryRunner: jest.fn(() => lock) } as unknown as DataSource;
    const runner = jest.fn();

    await expect(
      new RequestBackfillBootService(ds, makeState(false).repo).runOnce(runner),
    ).resolves.toBe(false);
    expect(lock.query).toHaveBeenCalledWith('SELECT pg_try_advisory_lock($1) AS locked', [
      REQUEST_BACKFILL_LOCK_KEY,
    ]);
    expect(runner).not.toHaveBeenCalled();
    expect(lock.release).toHaveBeenCalled();
  });

  it('passes its logger, marks completion, and releases the shared lock', async () => {
    const lock = makeLock(true);
    const ds = { createQueryRunner: jest.fn(() => lock) } as unknown as DataSource;
    const state = makeState(false);
    const runner = jest.fn(async () => ({ windows: 2, requests: 2, attempts: 3, rejections: 1 }));

    await expect(new RequestBackfillBootService(ds, state.repo).runOnce(runner)).resolves.toBe(
      true,
    );
    expect(runner).toHaveBeenCalledWith(
      ds,
      expect.objectContaining({ log: expect.any(Function) }),
      expect.objectContaining({
        analyze: true,
        finalize: true,
        before: expect.any(String),
        fallbackBefore: expect.any(String),
      }),
    );
    expect(state.values).toHaveBeenCalledWith({ name: REQUEST_BACKFILL_NAME });
    expect(state.execute).toHaveBeenCalled();
    expect(lock.query).toHaveBeenCalledWith('SELECT pg_advisory_unlock($1)', [
      REQUEST_BACKFILL_LOCK_KEY,
    ]);
    expect(lock.release).toHaveBeenCalled();
  });

  it('re-checks completion after acquiring the lock', async () => {
    const lock = makeLock(true);
    const ds = { createQueryRunner: jest.fn(() => lock) } as unknown as DataSource;
    const state = makeState(false);
    state.countBy.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    const runner = jest.fn();

    await expect(new RequestBackfillBootService(ds, state.repo).runOnce(runner)).resolves.toBe(
      true,
    );
    expect(runner).not.toHaveBeenCalled();
    expect(lock.release).toHaveBeenCalled();
  });

  it('unlocks and releases when the runner fails', async () => {
    const lock = makeLock(true);
    const ds = { createQueryRunner: jest.fn(() => lock) } as unknown as DataSource;
    const runner = jest.fn(async () => {
      throw new Error('boom');
    });

    await expect(
      new RequestBackfillBootService(ds, makeState(false).repo).runOnce(runner),
    ).rejects.toThrow('boom');
    expect(lock.query).toHaveBeenCalledWith('SELECT pg_advisory_unlock($1)', [
      REQUEST_BACKFILL_LOCK_KEY,
    ]);
    expect(lock.release).toHaveBeenCalled();
  });

  it('swallows unlock failures and still releases', async () => {
    const lock = makeLock(true);
    lock.query.mockImplementation(async (sql: string) => {
      if (sql.includes('pg_try_advisory_lock')) return [{ locked: true }];
      throw new Error('unlock failed');
    });
    const ds = { createQueryRunner: jest.fn(() => lock) } as unknown as DataSource;

    await expect(
      new RequestBackfillBootService(ds, makeState(false).repo).runOnce(
        jest.fn().mockResolvedValue({ windows: 0, requests: 0, attempts: 0, rejections: 0 }),
      ),
    ).resolves.toBe(true);
    expect(lock.release).toHaveBeenCalled();
  });

  it('uses the production backfill runner by default', async () => {
    const lock = makeLock(true);
    const transaction = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockImplementation(async (sql: string) => {
        if (sql.includes('FALLBACK_PRIMARY_WINDOW_END_SQL')) return [{ end_id: null }];
        if (sql.includes("status = 'fallback_error'") && sql.includes('max(id)')) {
          return [{ end_id: null }];
        }
        if (sql.includes('max(pair_seq)')) return [{ max_seq: 0 }];
        if (sql.includes('INSERT INTO "requests"')) return [{ n: 0 }];
        if (sql.includes('UPDATE "provider_attempts"')) return [{ n: 0 }];
        return undefined;
      }),
    };
    const ds = {
      createQueryRunner: jest.fn().mockReturnValueOnce(lock).mockReturnValue(transaction),
      query: jest
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce([{ end_id: null }]),
    } as unknown as DataSource;
    const state = makeState(false);

    await expect(new RequestBackfillBootService(ds, state.repo).runOnce()).resolves.toBe(true);
    expect(state.execute).toHaveBeenCalled();
  });

  it('skips a tail sweep when no grace-aged writes are waiting', async () => {
    const ds = {
      query: jest.fn().mockResolvedValue([{ pending: false }]),
      createQueryRunner: jest.fn(),
    } as unknown as DataSource;
    const runner = jest.fn();

    await expect(
      new RequestBackfillBootService(ds, makeState(true).repo).runTailOnce(runner),
    ).resolves.toBe(true);
    expect(ds.createQueryRunner).not.toHaveBeenCalled();
    expect(runner).not.toHaveBeenCalled();
  });

  it('tail-sweeps old-replica writes without re-analyzing or re-finalizing', async () => {
    const lock = makeLock(true);
    const query = jest
      .fn()
      .mockResolvedValueOnce([{ pending: true }])
      .mockResolvedValueOnce([{ pending: true }]);
    const ds = {
      query,
      createQueryRunner: jest.fn(() => lock),
    } as unknown as DataSource;
    const runner = jest.fn(
      async (
        _dataSource: DataSource,
        _logger: Pick<Logger, 'log'>,
        _options: {
          analyze?: boolean;
          finalize?: boolean;
          before?: string;
          fallbackBefore?: string;
        },
      ) => ({
        windows: 1,
        requests: 1,
        attempts: 2,
        rejections: 0,
      }),
    );

    await expect(
      new RequestBackfillBootService(ds, makeState(true).repo).runTailOnce(runner),
    ).resolves.toBe(true);

    const options = runner.mock.calls[0]![2];
    expect(options).toEqual(
      expect.objectContaining({
        analyze: false,
        finalize: false,
        before: expect.any(String),
        fallbackBefore: expect.any(String),
      }),
    );
    expect(Date.parse(options.fallbackBefore!)).toBeGreaterThan(Date.parse(options.before!));
    expect(lock.query).toHaveBeenCalledWith('SELECT pg_advisory_unlock($1)', [
      REQUEST_BACKFILL_LOCK_KEY,
    ]);
  });
});
