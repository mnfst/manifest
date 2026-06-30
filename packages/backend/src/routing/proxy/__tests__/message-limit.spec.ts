import { DEFAULT_MAX_MESSAGES_PER_REQUEST, parseMaxMessagesPerRequest } from '../message-limit';

describe('parseMaxMessagesPerRequest', () => {
  it('defaults to 1000 when env var is unset', () => {
    expect(parseMaxMessagesPerRequest(undefined)).toBe(DEFAULT_MAX_MESSAGES_PER_REQUEST);
  });

  it('uses the configured value when env var is a positive integer', () => {
    expect(parseMaxMessagesPerRequest('2500')).toBe(2500);
  });

  it.each(['2500abc', '2500.5', '2_500', ' 2500', 'abc'])(
    'falls back to 1000 when env var is not digits-only: %s',
    (rawValue) => {
      expect(parseMaxMessagesPerRequest(rawValue)).toBe(DEFAULT_MAX_MESSAGES_PER_REQUEST);
    },
  );

  it('falls back to 1000 when env var is zero', () => {
    expect(parseMaxMessagesPerRequest('0')).toBe(DEFAULT_MAX_MESSAGES_PER_REQUEST);
  });

  it('falls back to 1000 when env var exceeds safe integer range', () => {
    expect(parseMaxMessagesPerRequest('9007199254740992')).toBe(DEFAULT_MAX_MESSAGES_PER_REQUEST);
  });
});
