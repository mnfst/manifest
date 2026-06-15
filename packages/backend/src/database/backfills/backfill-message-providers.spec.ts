import {
  BackfillGateway,
  BackfillTimeouts,
  DEFAULT_BACKFILL_OPTIONS,
  isRetryableBackfillError,
  runMessageProviderBackfill,
} from './backfill-message-providers';

function gatewayWith(ends: (string | null)[], stampPerWindow = 5): jest.Mocked<BackfillGateway> {
  let call = 0;
  return {
    nextWindowEnd: jest.fn(async (_afterId: string, _batchSize: number) => ends[call++] ?? null),
    stampWindow: jest.fn(
      async (_afterId: string, _endId: string, _timeouts: BackfillTimeouts) => stampPerWindow,
    ),
  };
}

describe('runMessageProviderBackfill', () => {
  it('walks keyset windows until nextWindowEnd returns null, summing stamped counts', async () => {
    const gateway = gatewayWith(['id-10', 'id-20', null]);
    const sleep = jest.fn(async () => undefined);

    const result = await runMessageProviderBackfill(gateway, { sleep, throttleMs: 10 });

    expect(result).toEqual({ windows: 2, stamped: 10 });
    expect(gateway.nextWindowEnd).toHaveBeenNthCalledWith(
      1,
      '',
      DEFAULT_BACKFILL_OPTIONS.batchSize,
    );
    expect(gateway.nextWindowEnd).toHaveBeenNthCalledWith(
      2,
      'id-10',
      DEFAULT_BACKFILL_OPTIONS.batchSize,
    );
    expect(gateway.stampWindow).toHaveBeenNthCalledWith(1, '', 'id-10', expect.any(Object));
    expect(gateway.stampWindow).toHaveBeenNthCalledWith(2, 'id-10', 'id-20', expect.any(Object));
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(10);
  });

  it('does nothing but report zero when there are no rows to stamp', async () => {
    const gateway = gatewayWith([null]);

    const result = await runMessageProviderBackfill(gateway, { throttleMs: 0 });

    expect(result).toEqual({ windows: 0, stamped: 0 });
    expect(gateway.stampWindow).not.toHaveBeenCalled();
  });

  it('passes configured timeouts through to each window and skips sleep when throttle is 0', async () => {
    const gateway = gatewayWith(['id-10', null]);
    const sleep = jest.fn(async () => undefined);

    await runMessageProviderBackfill(gateway, {
      sleep,
      throttleMs: 0,
      lockTimeoutMs: 1234,
      statementTimeoutMs: 5678,
    });

    expect(gateway.stampWindow).toHaveBeenCalledWith('', 'id-10', {
      lockTimeoutMs: 1234,
      statementTimeoutMs: 5678,
    });
    expect(sleep).not.toHaveBeenCalled();
  });

  it('emits a progress log every 25 windows', async () => {
    const ends: (string | null)[] = Array.from({ length: 25 }, (_, i) => `id-${i}`);
    ends.push(null);
    const gateway = gatewayWith(ends, 1);
    const logger = { log: jest.fn() };

    await runMessageProviderBackfill(gateway, { sleep: jest.fn(async () => undefined), logger });

    expect(logger.log).toHaveBeenCalledWith(
      'backfill: 25 window(s) processed, 25 message(s) stamped so far',
    );
    expect(logger.log).toHaveBeenCalledWith(
      'backfill: done — stamped 25 message(s) across 25 window(s)',
    );
  });

  it('falls back to a real timer-based sleep when none is injected', async () => {
    const gateway = gatewayWith(['id-10', null], 2);

    const result = await runMessageProviderBackfill(gateway, { throttleMs: 1 });

    expect(result).toEqual({ windows: 1, stamped: 2 });
  });

  it('retries a window that hits a transient error, then continues', async () => {
    const gateway = gatewayWith(['id-10', null]);
    gateway.stampWindow
      .mockRejectedValueOnce(new Error('canceling statement due to statement timeout'))
      .mockResolvedValueOnce(7);
    const sleep = jest.fn(async () => undefined);
    const logger = { log: jest.fn() };

    const result = await runMessageProviderBackfill(gateway, {
      sleep,
      throttleMs: 0,
      retryBackoffMs: 10,
      logger,
    });

    expect(result).toEqual({ windows: 1, stamped: 7 });
    expect(gateway.stampWindow).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(10); // retryBackoffMs * attempt 1
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('retrying'));
  });

  it('gives up after maxRetries consecutive transient failures', async () => {
    const gateway = gatewayWith(['id-10', null]);
    gateway.stampWindow.mockRejectedValue(new Error('deadlock detected'));

    await expect(
      runMessageProviderBackfill(gateway, {
        sleep: jest.fn(async () => undefined),
        maxRetries: 2,
        retryBackoffMs: 1,
      }),
    ).rejects.toThrow('deadlock detected');
    expect(gateway.stampWindow).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it('does not retry a non-retryable error', async () => {
    const gateway = gatewayWith(['id-10', null]);
    gateway.stampWindow.mockRejectedValue(new Error('column "x" does not exist'));

    await expect(
      runMessageProviderBackfill(gateway, { sleep: jest.fn(async () => undefined) }),
    ).rejects.toThrow('does not exist');
    expect(gateway.stampWindow).toHaveBeenCalledTimes(1);
  });
});

describe('isRetryableBackfillError', () => {
  it('flags transient database errors as retryable', () => {
    for (const message of [
      'canceling statement due to statement timeout',
      'deadlock detected',
      'canceling statement due to lock timeout',
      'connection terminated unexpectedly',
      'read ECONNRESET',
    ]) {
      expect(isRetryableBackfillError(new Error(message))).toBe(true);
    }
  });

  it('treats logic/schema errors and non-Error values as non-retryable', () => {
    expect(isRetryableBackfillError(new Error('column "x" does not exist'))).toBe(false);
    expect(isRetryableBackfillError('some string')).toBe(false);
    expect(isRetryableBackfillError(null)).toBe(false);
  });
});
