import { runRequestBackfill, type RequestBackfillGateway } from './backfill-requests';
import { FINALIZE_PENDING_REQUESTS_SQL } from './backfill-requests.gateway';

describe('runRequestBackfill', () => {
  it('walks bounded windows, throttles, and finalizes only after all rows link', async () => {
    const gateway: RequestBackfillGateway = {
      analyze: jest.fn().mockResolvedValue(undefined),
      nextWindowEnd: jest
        .fn()
        .mockResolvedValueOnce('b')
        .mockResolvedValueOnce('d')
        .mockResolvedValueOnce(null),
      backfillWindow: jest
        .fn()
        .mockResolvedValueOnce({ requests: 2, attempts: 2, rejections: 0 })
        .mockResolvedValueOnce({ requests: 1, attempts: 1, rejections: 1 }),
      finalize: jest.fn().mockResolvedValue(undefined),
    };
    const sleep = jest.fn().mockResolvedValue(undefined);

    await expect(
      runRequestBackfill(gateway, { batchSize: 2, throttleMs: 5, sleep }),
    ).resolves.toEqual({ windows: 2, requests: 3, attempts: 3, rejections: 1 });

    expect(gateway.nextWindowEnd).toHaveBeenNthCalledWith(1, '', 2);
    expect(gateway.nextWindowEnd).toHaveBeenNthCalledWith(2, 'b', 2);
    expect(gateway.backfillWindow).toHaveBeenNthCalledWith(1, '', 'b', expect.any(Object));
    expect(gateway.backfillWindow).toHaveBeenNthCalledWith(2, 'b', 'd', expect.any(Object));
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(gateway.finalize).toHaveBeenCalledTimes(1);
  });

  it('retries a timeout without advancing the cursor', async () => {
    const gateway: RequestBackfillGateway = {
      analyze: jest.fn().mockResolvedValue(undefined),
      nextWindowEnd: jest.fn().mockResolvedValueOnce('b').mockResolvedValueOnce(null),
      backfillWindow: jest
        .fn()
        .mockRejectedValueOnce(new Error('canceling statement due to statement timeout'))
        .mockResolvedValueOnce({ requests: 1, attempts: 1, rejections: 0 }),
      finalize: jest.fn().mockResolvedValue(undefined),
    };
    const sleep = jest.fn().mockResolvedValue(undefined);

    const result = await runRequestBackfill(gateway, {
      throttleMs: 0,
      retryBackoffMs: 10,
      sleep,
    });

    expect(result.windows).toBe(1);
    expect(gateway.backfillWindow).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(10);
  });

  it.each([
    ['batchSize', 0],
    ['batchSize', Number.NaN],
    ['throttleMs', -1],
    ['maxRetries', -1],
    ['retryBackoffMs', Number.POSITIVE_INFINITY],
    ['lockTimeoutMs', 0],
    ['statementTimeoutMs', -1],
  ] as const)('rejects invalid %s before touching the gateway', async (name, value) => {
    const gateway: RequestBackfillGateway = {
      analyze: jest.fn(),
      nextWindowEnd: jest.fn(),
      backfillWindow: jest.fn(),
      finalize: jest.fn(),
    };

    await expect(runRequestBackfill(gateway, { [name]: value })).rejects.toThrow(name);
    expect(gateway.analyze).not.toHaveBeenCalled();
  });
});

describe('request backfill finalization', () => {
  it('only finalizes backfill-created pending parents', () => {
    expect(FINALIZE_PENDING_REQUESTS_SQL).toContain("r.id LIKE 'legacy-autofix-%'");
    expect(FINALIZE_PENDING_REQUESTS_SQL).toContain("r.id LIKE 'legacy-trace-%'");
    expect(FINALIZE_PENDING_REQUESTS_SQL).toContain('pa.id = r.id');
    expect(FINALIZE_PENDING_REQUESTS_SQL).not.toContain(
      `SELECT id FROM "requests" WHERE status = 'pending'`,
    );
  });
});
