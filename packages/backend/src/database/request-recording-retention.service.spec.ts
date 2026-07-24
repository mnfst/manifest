import { Logger } from '@nestjs/common';
import { isBillingEnabled } from '../billing/billing.config';
import { RequestRecordingRetentionService } from './request-recording-retention.service';

jest.mock('../billing/billing.config', () => ({
  isBillingEnabled: jest.fn(),
}));

const mockedIsBillingEnabled = jest.mocked(isBillingEnabled);

describe('RequestRecordingRetentionService', () => {
  const query = jest.fn();
  const get = jest.fn();
  let service: RequestRecordingRetentionService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    get.mockReturnValue(null);
    mockedIsBillingEnabled.mockReturnValue(true);
    service = new RequestRecordingRetentionService({ query } as never, { get } as never);
  });

  afterEach(() => jest.restoreAllMocks());

  it('deletes Free recordings after 7 days and Pro recordings after 365 days', async () => {
    query.mockResolvedValue([{ deleted: '5' }]);

    await expect(service.deleteExpiredRecordings()).resolves.toBe(5);

    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('deleted_free'), [7, 365]);
    expect(query.mock.calls[0][0]).toContain('AND NOT EXISTS');
    expect(query.mock.calls[0][0]).toContain('deleted_pro');
    expect(query.mock.calls[0][0]).toContain('AND EXISTS');
    expect(query.mock.calls[0][0]).toContain("subscription.status IN ('active', 'trialing')");
    expect(query.mock.calls[0][0]).toContain('pg_try_advisory_xact_lock');
  });

  it('uses one global retention override for every plan', async () => {
    get.mockReturnValue(30);
    query.mockResolvedValue([{ deleted: 4 }]);
    service = new RequestRecordingRetentionService({ query } as never, { get } as never);

    await expect(service.deleteExpiredRecordings()).resolves.toBe(4);

    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM request_recordings'),
      [30],
    );
    expect(query.mock.calls[0][0]).not.toContain('subscription');
    expect(query.mock.calls[0][0]).toContain('pg_try_advisory_xact_lock');
  });

  it('uses the 365-day default outside billing deployments', async () => {
    mockedIsBillingEnabled.mockReturnValue(false);
    query.mockResolvedValue([{ deleted: 0 }]);

    await expect(service.deleteExpiredRecordings()).resolves.toBe(0);

    expect(query).toHaveBeenCalledWith(expect.any(String), [365]);
  });

  it('treats an empty delete result as zero', async () => {
    get.mockReturnValue(90);
    query.mockResolvedValue([]);
    service = new RequestRecordingRetentionService({ query } as never, { get } as never);

    await expect(service.deleteExpiredRecordings()).resolves.toBe(0);
  });

  it('logs and swallows cleanup failures', async () => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    query.mockRejectedValue(new Error('database unavailable'));

    await expect(service.deleteExpiredRecordings()).resolves.toBe(0);

    expect(error).toHaveBeenCalledWith('Request recording retention failed: database unavailable');
  });

  it('logs non-Error cleanup failures', async () => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    query.mockRejectedValue('offline');

    await expect(service.deleteExpiredRecordings()).resolves.toBe(0);

    expect(error).toHaveBeenCalledWith('Request recording retention failed: offline');
  });
});
