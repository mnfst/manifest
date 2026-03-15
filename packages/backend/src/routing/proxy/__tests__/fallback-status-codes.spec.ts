import { shouldTriggerFallback, FALLBACK_EXHAUSTED_STATUS } from '../fallback-status-codes';

describe('shouldTriggerFallback', () => {
  it.each([400, 401, 403, 404, 405, 409, 422, 429, 500, 501, 502, 503, 504])(
    'should return true for error status %d',
    (status) => {
      expect(shouldTriggerFallback(status)).toBe(true);
    },
  );

  it.each([200, 201, 204, 301, 302])('should return false for non-error status %d', (status) => {
    expect(shouldTriggerFallback(status)).toBe(false);
  });

  it('should return false for 424 (fallback exhausted)', () => {
    expect(shouldTriggerFallback(424)).toBe(false);
  });
});

describe('FALLBACK_EXHAUSTED_STATUS', () => {
  it('should be 424', () => {
    expect(FALLBACK_EXHAUSTED_STATUS).toBe(424);
  });

  it('should not trigger fallback', () => {
    expect(shouldTriggerFallback(FALLBACK_EXHAUSTED_STATUS)).toBe(false);
  });
});
