// SSRF revalidation tests for ProviderClient.
//
// The provider-client.ts implements a defense-in-depth check
// (`requiresSsrfRevalidation` → validatePublicUrl at forward time) so
// that user-supplied custom-provider URLs can't be flipped to private /
// metadata addresses via DNS rebinding *after* registration. The real
// validator is a no-op when NODE_ENV === 'test' (see
// `common/utils/url-validation.ts`), so we jest.mock both modules to
// force the security branch to execute.

jest.mock('../../../common/utils/url-validation', () => ({
  validatePublicUrl: jest.fn(),
}));
jest.mock('../../../common/utils/detect-self-hosted', () => ({
  isSelfHosted: jest.fn().mockReturnValue(false),
}));

import { ProviderClient } from '../provider-client';
import { buildCustomEndpoint, ProviderEndpoint } from '../provider-endpoints';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { validatePublicUrl } = require('../../../common/utils/url-validation');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { isSelfHosted } = require('../../../common/utils/detect-self-hosted');

const mockFetch = jest.fn();
(globalThis as unknown as { fetch: typeof fetch }).fetch = mockFetch;

const body = {
  messages: [{ role: 'user', content: 'Hello' }],
  temperature: 0.7,
};

describe('ProviderClient — SSRF revalidation for custom endpoints', () => {
  let client: ProviderClient;

  beforeEach(() => {
    client = new ProviderClient();
    mockFetch.mockReset();
    (validatePublicUrl as jest.Mock).mockReset();
    (isSelfHosted as jest.Mock).mockReset().mockReturnValue(false);
  });

  it('re-validates URL through validatePublicUrl when endpoint requires revalidation', async () => {
    mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
    (validatePublicUrl as jest.Mock).mockResolvedValue(undefined);

    // buildCustomEndpoint sets requiresSsrfRevalidation: true.
    const customEndpoint = buildCustomEndpoint('https://upstream.example.com/v1');

    await client.forward({
      provider: 'custom:abc',
      apiKey: 'sk-cust',
      model: 'my-model',
      body,
      stream: false,
      customEndpoint,
    });

    expect(validatePublicUrl).toHaveBeenCalledTimes(1);
    const [calledUrl, calledOpts] = (validatePublicUrl as jest.Mock).mock.calls[0];
    // normalizeProviderBaseUrl strips trailing /v1, then buildPath adds /v1/chat/completions.
    expect(calledUrl).toBe('https://upstream.example.com/v1/chat/completions');
    expect(calledOpts).toEqual({ allowPrivate: false });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('forwards allowPrivate=true to validatePublicUrl in self-hosted mode', async () => {
    mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
    (validatePublicUrl as jest.Mock).mockResolvedValue(undefined);
    (isSelfHosted as jest.Mock).mockReturnValue(true);

    const customEndpoint = buildCustomEndpoint('http://localhost:8000');

    await client.forward({
      provider: 'custom:local',
      apiKey: 'k',
      model: 'm',
      body,
      stream: false,
      customEndpoint,
    });

    const [, calledOpts] = (validatePublicUrl as jest.Mock).mock.calls[0];
    expect(calledOpts).toEqual({ allowPrivate: true });
  });

  it('refuses to forward and never calls fetch when revalidation throws (DNS rebinding sim)', async () => {
    // Simulates the URL passing initial registration but the hostname
    // rebinding to a private/metadata address by the time we forward.
    (validatePublicUrl as jest.Mock).mockRejectedValue(
      new Error('URLs pointing to cloud metadata endpoints are not allowed'),
    );

    const customEndpoint = buildCustomEndpoint('https://victim.example.com');

    await expect(
      client.forward({
        provider: 'custom:rebound',
        apiKey: 'sk-cust',
        model: 'm',
        body,
        stream: false,
        customEndpoint,
      }),
    ).rejects.toThrow(
      /Refusing to forward to disallowed URL.*cloud metadata endpoints are not allowed/,
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('wraps non-Error rejections from validatePublicUrl with Refusing-to-forward prefix', async () => {
    (validatePublicUrl as jest.Mock).mockRejectedValue('private-network-blocked');

    const customEndpoint = buildCustomEndpoint('https://rebound.example.com');

    await expect(
      client.forward({
        provider: 'custom:x',
        apiKey: 'k',
        model: 'm',
        body,
        stream: false,
        customEndpoint,
      }),
    ).rejects.toThrow('Refusing to forward to disallowed URL: private-network-blocked');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('does NOT call validatePublicUrl for built-in endpoints (no revalidation flag)', async () => {
    mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

    await client.forward({
      provider: 'openai',
      apiKey: 'sk-test',
      model: 'gpt-4o',
      body,
      stream: false,
    });

    expect(validatePublicUrl).not.toHaveBeenCalled();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('does NOT call validatePublicUrl when a custom endpoint omits requiresSsrfRevalidation', async () => {
    mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
    // Hand-built endpoint without the revalidation flag — exercises the
    // `!endpoint.requiresSsrfRevalidation` branch.
    const customEndpoint: ProviderEndpoint = {
      baseUrl: 'https://trusted-template.example.com',
      buildHeaders: (key: string) => ({
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      }),
      buildPath: () => '/chat/completions',
      format: 'openai',
    };

    await client.forward({
      provider: 'custom:no-revalidate',
      apiKey: 'sk',
      model: 'm',
      body,
      stream: false,
      customEndpoint,
    });

    expect(validatePublicUrl).not.toHaveBeenCalled();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
