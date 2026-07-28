import {
  DEFAULT_REQUEST_QUOTA_RESET_AT,
  REQUEST_QUOTA_RESET_AT_ENV,
  requestQuotaResetAtMs,
  requestQuotaWindowStartForTimestamp,
  requestQuotaWindowStartMs,
} from './request-quota-window';

describe('request quota window', () => {
  const original = process.env[REQUEST_QUOTA_RESET_AT_ENV];

  afterEach(() => {
    if (original === undefined) delete process.env[REQUEST_QUOTA_RESET_AT_ENV];
    else process.env[REQUEST_QUOTA_RESET_AT_ENV] = original;
  });

  it('uses the rollout reset during its calendar month', () => {
    delete process.env[REQUEST_QUOTA_RESET_AT_ENV];

    expect(requestQuotaWindowStartMs(Date.UTC(2026, 6, 1))).toBe(
      Date.parse(DEFAULT_REQUEST_QUOTA_RESET_AT),
    );
  });

  it('uses the calendar month after the rollout reset', () => {
    delete process.env[REQUEST_QUOTA_RESET_AT_ENV];
    const august = Date.UTC(2026, 7, 1);

    expect(requestQuotaWindowStartMs(august)).toBe(august);
  });

  it('accepts a deployment-specific reset override', () => {
    process.env[REQUEST_QUOTA_RESET_AT_ENV] = '2026-07-10T12:34:56Z';

    expect(requestQuotaResetAtMs()).toBe(Date.parse('2026-07-10T12:34:56Z'));
  });

  it('falls back when the reset override is invalid', () => {
    process.env[REQUEST_QUOTA_RESET_AT_ENV] = 'not-a-date';

    expect(requestQuotaResetAtMs()).toBe(Date.parse(DEFAULT_REQUEST_QUOTA_RESET_AT));
  });

  it('derives a UTC calendar window from a request timestamp', () => {
    delete process.env[REQUEST_QUOTA_RESET_AT_ENV];

    expect(requestQuotaWindowStartForTimestamp('2026-08-31T23:59:59.000-07:00')).toBe(
      Date.UTC(2026, 8, 1),
    );
  });
});
