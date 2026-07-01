import { HttpHealingClient } from '../http-healing-client';
import type { HealOutcome, HealRequest, HealResponse } from '../phoenix.types';

/** Minimal Response-like stub for fetch resolutions. */
function fakeResponse(ok: boolean, status: number, body: unknown): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as unknown as Response;
}

function makeHealRequest(): HealRequest {
  return {
    provider: 'openai',
    api: 'responses',
    request: { max_tokens: 100 },
    response: { statusCode: 400, error: { message: 'bad' } },
  };
}

describe('HttpHealingClient', () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  describe('heal', () => {
    it('POSTs to `${baseUrl}/api/heal` and returns parsed JSON on 200', async () => {
      const healResponse: HealResponse = { status: 'no_patch', issueId: 'i-1' };
      fetchSpy.mockResolvedValue(fakeResponse(true, 200, healResponse));
      const client = new HttpHealingClient('http://x', 1000);
      const input = makeHealRequest();

      const res = await client.heal(input);

      expect(res).toEqual(healResponse);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toBe('http://x/api/heal');
      expect(init.method).toBe('POST');
      expect(init.headers).toEqual({ 'content-type': 'application/json' });
      expect(init.body).toBe(JSON.stringify(input));
    });

    it('throws when fetch resolves non-ok (500)', async () => {
      fetchSpy.mockResolvedValue(fakeResponse(false, 500, {}));
      const client = new HttpHealingClient('http://x', 1000);

      await expect(client.heal(makeHealRequest())).rejects.toThrow(
        'Phoenix /api/heal responded 500',
      );
    });

    it('strips a trailing slash from baseUrl so the heal URL has no double slash', async () => {
      fetchSpy.mockResolvedValue(fakeResponse(true, 200, { status: 'no_patch', issueId: 'i' }));
      const client = new HttpHealingClient('http://x/', 1000);

      await client.heal(makeHealRequest());

      expect(fetchSpy.mock.calls[0][0]).toBe('http://x/api/heal');
    });
  });

  describe('reportOutcome', () => {
    const outcome: HealOutcome = { retryStatusCode: 200 };

    it('PATCHes `${baseUrl}/api/heal-attempts/<id>` (URL-encoded) and returns parsed JSON on 200', async () => {
      const confirmResponse = {
        healAttemptId: 'heal/1',
        status: 'succeeded',
        issueStatus: 'confirmed',
      };
      fetchSpy.mockResolvedValue(fakeResponse(true, 200, confirmResponse));
      const client = new HttpHealingClient('http://x', 1000);

      const res = await client.reportOutcome('heal/1', outcome);

      expect(res).toEqual(confirmResponse);
      const [url, init] = fetchSpy.mock.calls[0];
      // The '/' in the id must be percent-encoded.
      expect(url).toBe('http://x/api/heal-attempts/heal%2F1');
      expect(init.method).toBe('PATCH');
      expect(init.headers).toEqual({ 'content-type': 'application/json' });
      expect(init.body).toBe(JSON.stringify(outcome));
    });

    it('returns null on a non-ok response', async () => {
      fetchSpy.mockResolvedValue(fakeResponse(false, 404, {}));
      const client = new HttpHealingClient('http://x', 1000);

      const res = await client.reportOutcome('heal-1', outcome);

      expect(res).toBeNull();
    });

    it('returns null (does not throw) when fetch rejects', async () => {
      fetchSpy.mockRejectedValue(new Error('network down'));
      const client = new HttpHealingClient('http://x', 1000);

      await expect(client.reportOutcome('heal-1', outcome)).resolves.toBeNull();
    });
  });
});
