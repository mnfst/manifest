import { DataSource } from 'typeorm';

import {
  createBackfillDataSource,
  main,
  readBackfillOptions,
} from './backfill-message-providers.cli';
import { WINDOW_END_SQL } from './backfill-message-providers.gateway';

describe('readBackfillOptions', () => {
  it('parses numeric env knobs', () => {
    expect(
      readBackfillOptions({
        BACKFILL_BATCH_SIZE: '5000',
        BACKFILL_THROTTLE_MS: '100',
        BACKFILL_LOCK_TIMEOUT_MS: '3000',
        BACKFILL_STATEMENT_TIMEOUT_MS: '90000',
        BACKFILL_MAX_RETRIES: '8',
        BACKFILL_RETRY_BACKOFF_MS: '2000',
      }),
    ).toEqual({
      batchSize: 5000,
      throttleMs: 100,
      lockTimeoutMs: 3000,
      statementTimeoutMs: 90000,
      maxRetries: 8,
      retryBackoffMs: 2000,
    });
  });

  it('leaves knobs undefined when absent, blank, or non-numeric', () => {
    expect(readBackfillOptions({ BACKFILL_BATCH_SIZE: '', BACKFILL_THROTTLE_MS: 'abc' })).toEqual({
      batchSize: undefined,
      throttleMs: undefined,
      lockTimeoutMs: undefined,
      statementTimeoutMs: undefined,
      maxRetries: undefined,
      retryBackoffMs: undefined,
    });
    expect(readBackfillOptions({})).toEqual({
      batchSize: undefined,
      throttleMs: undefined,
      lockTimeoutMs: undefined,
      statementTimeoutMs: undefined,
      maxRetries: undefined,
      retryBackoffMs: undefined,
    });
  });
});

describe('createBackfillDataSource', () => {
  const url = (ds: DataSource): unknown => (ds.options as { url?: string }).url;

  it('prefers MIGRATION_DATABASE_URL, then DATABASE_URL, then a local default', () => {
    expect(
      url(
        createBackfillDataSource({
          MIGRATION_DATABASE_URL: 'postgres://m/x',
          DATABASE_URL: 'postgres://d/y',
        }),
      ),
    ).toBe('postgres://m/x');
    expect(url(createBackfillDataSource({ DATABASE_URL: 'postgres://d/y' }))).toBe(
      'postgres://d/y',
    );
    expect(url(createBackfillDataSource({}))).toContain('localhost:5432');
  });
});

describe('main', () => {
  function fakeDataSource(): DataSource & { initialize: jest.Mock; destroy: jest.Mock } {
    const query = jest.fn(async (sql: string) => {
      if (sql === WINDOW_END_SQL) {
        return [{ end_id: null }];
      }
      return undefined;
    });
    return {
      initialize: jest.fn(async () => undefined),
      destroy: jest.fn(async () => undefined),
      query,
      createQueryRunner: jest.fn(),
    } as unknown as DataSource & { initialize: jest.Mock; destroy: jest.Mock };
  }

  it('initializes, runs the backfill, logs the summary, and destroys the data source', async () => {
    const dataSource = fakeDataSource();
    const logger = { log: jest.fn(), error: jest.fn() };

    const result = await main({ env: {}, logger, dataSource });

    expect(result).toEqual({ windows: 0, stamped: 0 });
    expect(dataSource.initialize).toHaveBeenCalled();
    expect(logger.log).toHaveBeenCalledWith(
      'Backfill complete: stamped 0 message(s) across 0 window(s).',
    );
    expect(dataSource.destroy).toHaveBeenCalled();
  });

  it('destroys the data source even when the backfill throws', async () => {
    const dataSource = fakeDataSource();
    (dataSource.query as jest.Mock).mockRejectedValue(new Error('connection lost'));
    const logger = { log: jest.fn(), error: jest.fn() };

    await expect(main({ env: {}, logger, dataSource })).rejects.toThrow('connection lost');
    expect(dataSource.destroy).toHaveBeenCalled();
  });

  it('defaults env and logger when not supplied', async () => {
    const dataSource = fakeDataSource();
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      await main({ dataSource });
      expect(logSpy).toHaveBeenCalledWith(
        'Backfill complete: stamped 0 message(s) across 0 window(s).',
      );
    } finally {
      logSpy.mockRestore();
    }
  });
});
