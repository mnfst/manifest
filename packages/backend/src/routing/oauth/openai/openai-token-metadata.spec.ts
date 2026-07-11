import {
  extractOpenAiSubscriptionMetadata,
  parseOpenAiSubscriptionMetadata,
  serializeOpenAiSubscriptionMetadata,
} from './openai-token-metadata';

function token(payload: Record<string, unknown>): string {
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

  it('round-trips compact non-secret routing metadata and fails closed', () => {
    const serialized = serializeOpenAiSubscriptionMetadata({
      accountId: 'account-123',
      fedramp: true,
    });

    expect(serialized).toBe('{"a":"account-123","f":true}');
    expect(parseOpenAiSubscriptionMetadata(serialized)).toEqual({
      accountId: 'account-123',
      fedramp: true,
    });
    expect(parseOpenAiSubscriptionMetadata('{bad')).toEqual({});
    expect(parseOpenAiSubscriptionMetadata('{"a":"x\\r\\nInjected"}')).toEqual({
      accountId: 'xInjected',
    });
  });
});
