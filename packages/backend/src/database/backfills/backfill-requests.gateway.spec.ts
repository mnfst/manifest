import { DataSource } from 'typeorm';

import {
  CREATE_LEGACY_FALLBACK_GROUPS_SQL,
  INSERT_LEGACY_FALLBACK_REQUESTS_SQL,
  LINK_LEGACY_FALLBACK_ATTEMPTS_SQL,
  TypeOrmRequestBackfillGateway,
  REQUEST_BACKFILL_WINDOW_END_SQL,
} from './backfill-requests.gateway';

function mockQueryRunner() {
  return {
    connect: jest.fn(async () => undefined),
    startTransaction: jest.fn(async () => undefined),
    commitTransaction: jest.fn(async () => undefined),
    rollbackTransaction: jest.fn(async () => undefined),
    release: jest.fn(async () => undefined),
    query: jest.fn(),
  };
}

const timeouts = { lockTimeoutMs: 5_000, statementTimeoutMs: 60_000 };

describe('TypeOrmRequestBackfillGateway', () => {
  it('analyzes attempts and finds keyset window ends', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([{ end_id: 'attempt-9' }])
      .mockResolvedValueOnce([]);
    const gateway = new TypeOrmRequestBackfillGateway({ query } as unknown as DataSource);

    await gateway.analyze();
    await expect(gateway.nextWindowEnd('attempt-0', 100)).resolves.toBe('attempt-9');
    await expect(gateway.nextWindowEnd('attempt-9', 100)).resolves.toBeNull();
    expect(query).toHaveBeenCalledWith('ANALYZE "provider_attempts"');
    expect(query).toHaveBeenCalledWith(REQUEST_BACKFILL_WINDOW_END_SQL, ['attempt-0', 100]);
  });

  it('backfills a window in one timeout-guarded transaction', async () => {
    const runner = mockQueryRunner();
    runner.query
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([{ n: 2 }])
      .mockResolvedValueOnce([{ n: 1 }])
      .mockResolvedValueOnce([{ n: 3 }])
      .mockResolvedValueOnce([{ n: 4 }])
      .mockResolvedValueOnce(undefined);
    const gateway = new TypeOrmRequestBackfillGateway({
      createQueryRunner: jest.fn(() => runner),
    } as unknown as DataSource);

    await expect(gateway.backfillWindow('a', 'b', timeouts)).resolves.toEqual({
      requests: 5,
      attempts: 4,
      rejections: 1,
    });
    expect(runner.query).toHaveBeenNthCalledWith(1, "SET LOCAL lock_timeout = '5000ms'");
    expect(runner.query).toHaveBeenNthCalledWith(2, "SET LOCAL statement_timeout = '60000ms'");
    expect(runner.commitTransaction).toHaveBeenCalled();
    expect(runner.rollbackTransaction).not.toHaveBeenCalled();
    expect(runner.release).toHaveBeenCalled();
  });

  it('reconstructs unambiguous legacy fallback chains transactionally', async () => {
    const runner = mockQueryRunner();
    runner.query
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([{ n: 2 }])
      .mockResolvedValueOnce([{ n: 5 }]);
    const gateway = new TypeOrmRequestBackfillGateway({
      createQueryRunner: jest.fn(() => runner),
    } as unknown as DataSource);

    await expect(gateway.backfillFallbackGroups(timeouts)).resolves.toEqual({
      requests: 2,
      attempts: 5,
    });
    expect(runner.query).toHaveBeenCalledWith(CREATE_LEGACY_FALLBACK_GROUPS_SQL);
    expect(runner.query).toHaveBeenCalledWith(INSERT_LEGACY_FALLBACK_REQUESTS_SQL);
    expect(runner.query).toHaveBeenCalledWith(LINK_LEGACY_FALLBACK_ATTEMPTS_SQL);
    expect(runner.commitTransaction).toHaveBeenCalled();
  });

  it('finalizes pending requests and validates the foreign key', async () => {
    const runner = mockQueryRunner();
    runner.query.mockResolvedValue(undefined);
    const gateway = new TypeOrmRequestBackfillGateway({
      createQueryRunner: jest.fn(() => runner),
    } as unknown as DataSource);

    await gateway.finalize(timeouts);

    expect(runner.query).toHaveBeenCalledWith("SET LOCAL statement_timeout = '0'");
    expect(runner.query).toHaveBeenCalledWith(
      'ALTER TABLE "provider_attempts" VALIDATE CONSTRAINT "FK_provider_attempts_request"',
    );
    expect(runner.commitTransaction).toHaveBeenCalled();
    expect(runner.release).toHaveBeenCalled();
  });

  it('rolls back and releases when a window fails', async () => {
    const runner = mockQueryRunner();
    const error = new Error('deadlock');
    runner.query
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(error);
    const gateway = new TypeOrmRequestBackfillGateway({
      createQueryRunner: jest.fn(() => runner),
    } as unknown as DataSource);

    await expect(gateway.backfillWindow('a', 'b', timeouts)).rejects.toBe(error);
    expect(runner.rollbackTransaction).toHaveBeenCalled();
    expect(runner.commitTransaction).not.toHaveBeenCalled();
    expect(runner.release).toHaveBeenCalled();
  });
});
