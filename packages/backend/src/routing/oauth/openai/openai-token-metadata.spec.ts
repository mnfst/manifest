import {
  extractOpenAiSubscriptionMetadata,
  parseOpenAiSubscriptionMetadata,
  serializeOpenAiSubscriptionMetadata,
} from './openai-token-metadata';

function token(payload: unknown): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `header.${encoded}.signature`;
}

describe('extractOpenAiSubscriptionMetadata', () => {
  it('extracts the account and FedRAMP routing claims used by Codex', () => {
    const accessToken = token({
      'https://api.openai.com/auth': {
        chatgpt_account_id: 'account-123',
        chatgpt_account_is_fedramp: true,
      },
    });

    expect(extractOpenAiSubscriptionMetadata(accessToken)).toEqual({
      accountId: 'account-123',
      fedramp: true,
    });
  });

  it('accepts the top-level ID-token claim layout', () => {
    const idToken = token({
      chatgpt_account_id: 'account-top-level',
      chatgpt_account_is_fedramp: true,
    });

    expect(extractOpenAiSubscriptionMetadata(idToken)).toEqual({
      accountId: 'account-top-level',
      fedramp: true,
    });
  });

  it.each(['not-a-jwt', 'a.invalid-json.c', ''])('fails closed for %p', (accessToken) => {
    expect(extractOpenAiSubscriptionMetadata(accessToken)).toEqual({});
  });

  it.each([null, [], 'claims'])('fails closed for a decoded non-object payload: %p', (payload) => {
    expect(extractOpenAiSubscriptionMetadata(token(payload))).toEqual({});
  });

  it('falls back to top-level claims when the namespaced claim is malformed', () => {
    const accessToken = token({
      'https://api.openai.com/auth': [],
      chatgpt_account_id: 'top-level-fallback',
    });

    expect(extractOpenAiSubscriptionMetadata(accessToken)).toEqual({
      accountId: 'top-level-fallback',
    });
  });

  it('drops control characters and refuses oversized account ids', () => {
    const control = token({
      'https://api.openai.com/auth': { chatgpt_account_id: 'account\r\n-123' },
    });
    const oversized = token({
      'https://api.openai.com/auth': { chatgpt_account_id: 'x'.repeat(257) },
    });

    expect(extractOpenAiSubscriptionMetadata(control)).toEqual({ accountId: 'account-123' });
    expect(extractOpenAiSubscriptionMetadata(oversized)).toEqual({});
  });
});

describe('serializeOpenAiSubscriptionMetadata', () => {
  it('round-trips both compact routing fields', () => {
    const serialized = serializeOpenAiSubscriptionMetadata({
      accountId: 'account-123',
      fedramp: true,
    });

    expect(serialized).toBe('{"a":"account-123","f":true}');
    expect(parseOpenAiSubscriptionMetadata(serialized)).toEqual({
      accountId: 'account-123',
      fedramp: true,
    });
  });

  it.each([
    [{ accountId: 'account-only' }, '{"a":"account-only"}'],
    [{ fedramp: true }, '{"f":true}'],
    [{ accountId: ' account\r\n-123 ', fedramp: false }, '{"a":"account-123"}'],
    [{}, undefined],
    [{ fedramp: false }, undefined],
    [{ accountId: 'x'.repeat(257) }, undefined],
  ] as const)('serializes %p as %p', (metadata, expected) => {
    expect(serializeOpenAiSubscriptionMetadata(metadata)).toBe(expected);
  });
});

describe('parseOpenAiSubscriptionMetadata', () => {
  it.each([
    [undefined, {}],
    ['', {}],
    ['{bad', {}],
    ['null', {}],
    ['[]', {}],
    ['"metadata"', {}],
    ['x'.repeat(1025), {}],
    ['{"a":"account-only"}', { accountId: 'account-only' }],
    ['{"f":true}', { fedramp: true }],
    ['{"a":42,"f":true}', { fedramp: true }],
    ['{"a":"x\\r\\nInjected","f":false}', { accountId: 'xInjected' }],
    [JSON.stringify({ a: 'x'.repeat(257), f: false }), {}],
  ] as const)('parses %p as %p', (serialized, expected) => {
    expect(parseOpenAiSubscriptionMetadata(serialized)).toEqual(expected);
  });
});
