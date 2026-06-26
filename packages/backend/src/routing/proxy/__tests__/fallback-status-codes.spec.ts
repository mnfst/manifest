import { shouldTriggerFallback } from '../fallback-status-codes';

describe('shouldTriggerFallback', () => {
  it.each([400, 401, 403, 404, 405, 409, 422, 424, 429, 500, 501, 502, 503, 504])(
    'should return true for error status %d',
    (status) => {
      expect(shouldTriggerFallback(status)).toBe(true);
    },
  );

  it.each([200, 201, 204, 301, 302])('should return false for non-error status %d', (status) => {
    expect(shouldTriggerFallback(status)).toBe(false);
  });

  it('should not fallback for provider context length errors', () => {
    expect(
      shouldTriggerFallback(
        400,
        JSON.stringify({
          error: {
            message:
              "This model's maximum context length is 262144 tokens. However, your messages resulted in 334146 tokens.",
            code: 'context_length_exceeded',
          },
        }),
      ),
    ).toBe(false);
  });
});
