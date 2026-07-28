import { HealContractError } from '../healing-client';
import { HttpHealingClient } from '../http-healing-client';
import type {
  AutofixInstanceCredential,
  InstanceCredentialService,
} from '../instance-credential.service';
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
    traceId: 'trace-1',
    tenantId: 'tenant-1',
    provider: 'openai',
    authType: 'api_key',
    api: 'responses',
    request: { max_tokens: 100 },
    response: { statusCode: 400, error: { message: 'bad' } },
  };
}

function makeInstanceCredentials(initial: AutofixInstanceCredential | null = null) {
  let cached = initial;
  const service = {
    getOrRegister: jest.fn(
      async (register: () => Promise<{ instance_id: string; secret: string }>) => {
        if (!cached) {
          const issued = await register();
          cached = { instanceId: issued.instance_id, secret: issued.secret };
        }
        return cached;
      },
    ),
    clear: jest.fn(async (rejectedInstanceId: string) => {
      if (cached?.instanceId === rejectedInstanceId) cached = null;
    }),
  } as unknown as jest.Mocked<InstanceCredentialService>;
  return service;
}

const context = { harness: 'claude-code' } as const;

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

    it('throws a plain Error (a transport failure the breaker counts) on a 5xx', async () => {
      fetchSpy.mockResolvedValue(fakeResponse(false, 500, {}));
      const client = new HttpHealingClient('http://x', 1000);

      const err = await client.heal(makeHealRequest()).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(Error);
      expect(err).not.toBeInstanceOf(HealContractError);
      expect((err as Error).message).toBe('Phoenix /api/heal responded 500');
    });

    it('throws a HealContractError carrying the status on a 4xx (contract/auth error)', async () => {
      // 401 = Phoenix is up but rejected us (missing/invalid key). The service
      // must be able to tell this apart from an outage so it never trips the breaker.
      fetchSpy.mockResolvedValue(fakeResponse(false, 401, {}));
      const client = new HttpHealingClient('http://x', 1000, 'secret');

      const err = await client.heal(makeHealRequest()).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(HealContractError);
      expect((err as HealContractError).status).toBe(401);
    });

    it('sends the x-api-key header when an API key is configured', async () => {
      fetchSpy.mockResolvedValue(fakeResponse(true, 200, { status: 'no_patch', issueId: 'i' }));
      const client = new HttpHealingClient('http://x', 1000, 'secret-key');

      await client.heal(makeHealRequest());

      const [, init] = fetchSpy.mock.calls[0];
      expect(init.headers).toEqual({
        'content-type': 'application/json',
        'x-api-key': 'secret-key',
      });
    });

    it('registers lazily and sends all instance identity headers', async () => {
      fetchSpy
        .mockResolvedValueOnce(
          fakeResponse(true, 201, { instance_id: 'instance-1', secret: 'instance-secret' }),
        )
        .mockResolvedValueOnce(fakeResponse(true, 200, { status: 'no_patch', issueId: 'issue-1' }));
      const credentials = makeInstanceCredentials();
      const client = new HttpHealingClient('http://x', 1000, undefined, credentials, '6.15.1');

      await client.heal(makeHealRequest(), context);

      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(fetchSpy.mock.calls[0][0]).toBe('http://x/api/instances/register');
      expect(fetchSpy.mock.calls[0][1].body).toBe(
        JSON.stringify({ version: '6.15.1', schema_version: 1 }),
      );
      expect(fetchSpy.mock.calls[0][1].headers).toEqual({
        'content-type': 'application/json',
      });
      expect(fetchSpy.mock.calls[1][1].headers).toEqual({
        'content-type': 'application/json',
        Authorization: 'Bearer instance-secret',
        'X-Manifest-Instance': 'instance-1',
        'X-Manifest-Version': '6.15.1',
        'X-Manifest-Harness': 'claude-code',
      });
    });

    it('reuses the credential without another registration', async () => {
      fetchSpy
        .mockResolvedValueOnce(
          fakeResponse(true, 201, { instance_id: 'instance-1', secret: 'secret' }),
        )
        .mockResolvedValue(fakeResponse(true, 200, { status: 'no_patch', issueId: 'issue-1' }));
      const client = new HttpHealingClient(
        'http://x',
        1000,
        undefined,
        makeInstanceCredentials(),
        '6.15.1',
      );

      await client.heal(makeHealRequest(), context);
      await client.heal(makeHealRequest(), context);

      expect(
        fetchSpy.mock.calls.filter(([url]) => String(url).endsWith('/api/instances/register')),
      ).toHaveLength(1);
    });

    it('clears, re-registers once, and retries the original call once after a 401', async () => {
      fetchSpy
        .mockResolvedValueOnce(
          fakeResponse(true, 201, { instance_id: 'old-id', secret: 'old-secret' }),
        )
        .mockResolvedValueOnce(fakeResponse(false, 401, {}))
        .mockResolvedValueOnce(
          fakeResponse(true, 201, { instance_id: 'new-id', secret: 'new-secret' }),
        )
        .mockResolvedValueOnce(fakeResponse(true, 200, { status: 'no_patch', issueId: 'issue-1' }));
      const credentials = makeInstanceCredentials();
      const client = new HttpHealingClient('http://x', 1000, undefined, credentials, '6.15.1');

      await expect(client.heal(makeHealRequest(), context)).resolves.toMatchObject({
        status: 'no_patch',
      });
      expect(credentials.clear).toHaveBeenCalledWith('old-id');
      expect(fetchSpy).toHaveBeenCalledTimes(4);
      expect(fetchSpy.mock.calls[3][1].headers.Authorization).toBe('Bearer new-secret');
    });

    it('surfaces a second consecutive 401 without looping', async () => {
      fetchSpy
        .mockResolvedValueOnce(
          fakeResponse(true, 201, { instance_id: 'old-id', secret: 'old-secret' }),
        )
        .mockResolvedValueOnce(fakeResponse(false, 401, {}))
        .mockResolvedValueOnce(
          fakeResponse(true, 201, { instance_id: 'new-id', secret: 'new-secret' }),
        )
        .mockResolvedValueOnce(fakeResponse(false, 401, {}));
      const client = new HttpHealingClient(
        'http://x',
        1000,
        undefined,
        makeInstanceCredentials(),
        '6.15.1',
      );

      const err = await client.heal(makeHealRequest(), context).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(HealContractError);
      expect((err as HealContractError).status).toBe(401);
      expect(fetchSpy).toHaveBeenCalledTimes(4);
    });

    it('treats registration 5xx as a transport failure', async () => {
      fetchSpy.mockResolvedValue(fakeResponse(false, 503, {}));
      const client = new HttpHealingClient(
        'http://x',
        1000,
        undefined,
        makeInstanceCredentials(),
        '6.15.1',
      );

      const err = await client.heal(makeHealRequest(), context).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(Error);
      expect(err).not.toBeInstanceOf(HealContractError);
      expect((err as Error).message).toContain('register responded 503');
    });

    it('treats registration 4xx and malformed 201 responses as contract failures', async () => {
      const client = new HttpHealingClient(
        'http://x',
        1000,
        undefined,
        makeInstanceCredentials(),
        '6.15.1',
      );
      fetchSpy.mockResolvedValueOnce(fakeResponse(false, 429, {}));
      await expect(client.heal(makeHealRequest(), context)).rejects.toBeInstanceOf(
        HealContractError,
      );

      fetchSpy.mockResolvedValueOnce(fakeResponse(true, 201, { instance_id: '', secret: '' }));
      await expect(client.heal(makeHealRequest(), context)).rejects.toBeInstanceOf(
        HealContractError,
      );
    });

    it('requires a bounded harness on the instance-credential path', async () => {
      const client = new HttpHealingClient(
        'http://x',
        1000,
        undefined,
        makeInstanceCredentials(),
        '6.15.1',
      );

      await expect(client.heal(makeHealRequest())).rejects.toThrow('Autofix harness is required');
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('gives the static API key precedence over instance registration', async () => {
      fetchSpy.mockResolvedValue(fakeResponse(true, 200, { status: 'no_patch', issueId: 'i' }));
      const credentials = makeInstanceCredentials();
      const client = new HttpHealingClient('http://x', 1000, 'static-key', credentials, '6.15.1');

      await client.heal(makeHealRequest(), context);

      expect(credentials.getOrRegister).not.toHaveBeenCalled();
      expect(fetchSpy.mock.calls[0][1].headers).toEqual({
        'content-type': 'application/json',
        'x-api-key': 'static-key',
      });
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
        issueStatus: 'verified',
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

    it('sends the x-api-key header on the PATCH when an API key is configured', async () => {
      fetchSpy.mockResolvedValue(
        fakeResponse(true, 200, {
          healAttemptId: 'h',
          status: 'succeeded',
          issueStatus: 'unverified',
        }),
      );
      const client = new HttpHealingClient('http://x', 1000, 'secret-key');

      await client.reportOutcome('h', outcome);

      const [, init] = fetchSpy.mock.calls[0];
      expect(init.headers).toEqual({
        'content-type': 'application/json',
        'x-api-key': 'secret-key',
      });
    });

    it('sends instance identity headers on the PATCH', async () => {
      fetchSpy.mockResolvedValue(
        fakeResponse(true, 200, {
          healAttemptId: 'h',
          status: 'succeeded',
          issueStatus: 'unverified',
        }),
      );
      const client = new HttpHealingClient(
        'http://x',
        1000,
        undefined,
        makeInstanceCredentials({ instanceId: 'instance-1', secret: 'secret' }),
        '6.15.1',
      );

      await client.reportOutcome('h', outcome, context);

      expect(fetchSpy.mock.calls[0][1].headers['X-Manifest-Harness']).toBe('claude-code');
      expect(fetchSpy.mock.calls[0][1].headers.Authorization).toBe('Bearer secret');
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

  describe('observe', () => {
    /** Response stub whose body records that it was released. */
    function observeResponse(ok: boolean, status: number, cancel = jest.fn()) {
      return {
        response: { ok, status, body: { cancel } } as unknown as Response,
        cancel,
      };
    }

    it('POSTs the batch to `${baseUrl}/api/heal/observe`', async () => {
      const { response } = observeResponse(true, 200);
      fetchSpy.mockResolvedValue(response);
      const client = new HttpHealingClient('http://x', 1000, 'secret-key');
      const batch = [makeHealRequest()];

      await client.observe(batch);

      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toBe('http://x/api/heal/observe');
      expect(init.method).toBe('POST');
      expect(init.headers).toEqual({
        'content-type': 'application/json',
        'x-api-key': 'secret-key',
      });
      expect(JSON.parse(init.body)).toEqual({ observations: batch });
    });

    it('sends instance identity headers on observations', async () => {
      const { response } = observeResponse(true, 200);
      fetchSpy.mockResolvedValue(response);
      const client = new HttpHealingClient(
        'http://x',
        1000,
        undefined,
        makeInstanceCredentials({ instanceId: 'instance-1', secret: 'secret' }),
        '6.15.1',
      );

      await client.observe([makeHealRequest()], context);

      expect(fetchSpy.mock.calls[0][1].headers['X-Manifest-Harness']).toBe('claude-code');
      expect(fetchSpy.mock.calls[0][1].headers.Authorization).toBe('Bearer secret');
    });

    it('releases the response body so the connection is not held open', async () => {
      const { response, cancel } = observeResponse(true, 200);
      fetchSpy.mockResolvedValue(response);
      const client = new HttpHealingClient('http://x', 1000);

      await client.observe([makeHealRequest()]);

      expect(cancel).toHaveBeenCalledTimes(1);
    });

    it('does not call fetch for an empty batch', async () => {
      const client = new HttpHealingClient('http://x', 1000);

      await client.observe([]);

      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('swallows a non-ok response — evidence is lost, never the request', async () => {
      const { response, cancel } = observeResponse(false, 401);
      fetchSpy.mockResolvedValue(response);
      const client = new HttpHealingClient('http://x', 1000);

      await expect(client.observe([makeHealRequest()])).resolves.toBeUndefined();
      expect(cancel).toHaveBeenCalledTimes(1);
    });

    it('swallows a transport failure', async () => {
      fetchSpy.mockRejectedValue(new Error('network down'));
      const client = new HttpHealingClient('http://x', 1000);

      await expect(client.observe([makeHealRequest()])).resolves.toBeUndefined();
    });
  });
});
