import { ProviderParamSpecService } from '../../routing-core/provider-param-spec.service';
import { ProviderClient } from '../provider-client';
import { buildCustomEndpoint } from '../provider-endpoints';

const mockFetch = jest.fn();
(globalThis as unknown as { fetch: typeof fetch }).fetch = mockFetch;

describe('ProviderClient — ModelParams output token fields', () => {
  const client = new ProviderClient(
    undefined,
    undefined,
    undefined,
    new ProviderParamSpecService(),
  );
  const customEndpoint = buildCustomEndpoint('https://upstream.example.com');

  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
  });

  it('uses the ModelParams-declared completion field for a custom GPT-5 endpoint', async () => {
    await client.forward({
      provider: 'custom:azure',
      apiKey: 'sk-custom',
      model: 'gpt-5.4-mini',
      body: {
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 1024,
      },
      stream: false,
      authType: 'api_key',
      customEndpoint,
    });

    const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(sentBody.max_completion_tokens).toBe(1024);
    expect(sentBody.max_tokens).toBeUndefined();
  });

  it('keeps max_tokens when ModelParams declares the legacy field', async () => {
    await client.forward({
      provider: 'custom:azure',
      apiKey: 'sk-custom',
      model: 'o1-mini',
      body: {
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 1024,
      },
      stream: false,
      authType: 'api_key',
      customEndpoint,
    });

    const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(sentBody.max_tokens).toBe(1024);
    expect(sentBody.max_completion_tokens).toBeUndefined();
  });
});
