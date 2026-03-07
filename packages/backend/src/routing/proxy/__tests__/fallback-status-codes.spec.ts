import { shouldTriggerFallback } from '../fallback-status-codes';

describe('shouldTriggerFallback', () => {
  it.each([429, 500, 502, 503, 504])('should return true for retriable status %d', (status) => {
    expect(shouldTriggerFallback(status)).toBe(true);
  });

  it.each([200, 201, 204, 301, 302, 400, 401, 403, 404, 405, 409, 422, 501])(
    'should return false for non-retriable status %d',
    (status) => {
      expect(shouldTriggerFallback(status)).toBe(false);
    },
  );
});
