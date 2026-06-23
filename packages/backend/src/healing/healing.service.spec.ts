import { HealingService, HealAttemptContext } from './healing.service';

type FetchMock = jest.Mock;

const config = (overrides: Record<string, unknown> = {}) => {
  const values: Record<string, unknown> = {
    'app.healingApiUrl': 'http://healer.test',
    'app.healingApiToken': 'tok',
    'app.healingTimeoutMs': 3000,
    ...overrides,
  };
  return { get: jest.fn((k: string) => values[k]) };
};

const ctx = (overrides: Partial<HealAttemptContext> = {}): HealAttemptContext => ({
  requestId: 'req-1',
  tenantId: 'tenant-1',
  agentId: 'agent-1',
  provider: 'openai',
  model: 'gpt-4-vision-preview',
  body: {
    model: 'gpt-4-vision-preview',
    temperature: 0.5,
    messages: [{ role: 'user', content: 'hi' }],
  },
  errorStatus: 404,
  errorBodyText: JSON.stringify({
    error: {
      message: 'deprecated',
      type: 'not_found_error',
      code: 'model_not_found',
      param: 'model',
    },
  }),
  ...overrides,
});

const make = (
  cfg = config(),
  repo: { count: jest.Mock } = { count: jest.fn().mockResolvedValue(1) },
) => new HealingService(repo as never, cfg as never);

const fetchOk = (payload: unknown): FetchMock =>
  jest.fn().mockResolvedValue({ ok: true, json: jest.fn().mockResolvedValue(payload) });

describe('HealingService', () => {
  afterEach(() => {
    delete (global as { fetch?: unknown }).fetch;
    jest.restoreAllMocks();
  });

  it('reports configured only when a URL is set', () => {
    expect(make().configured).toBe(true);
    expect(make(config({ 'app.healingApiUrl': '' })).configured).toBe(false);
  });

  it('treats request-side 4xx (except 429) as candidates', () => {
    const svc = make();
    expect(svc.isCandidateStatus(404)).toBe(true);
    expect(svc.isCandidateStatus(400)).toBe(true);
    expect(svc.isCandidateStatus(429)).toBe(false);
    expect(svc.isCandidateStatus(500)).toBe(false);
    expect(svc.isCandidateStatus(200)).toBe(false);
  });

  it('reads per-agent activation from the repository', async () => {
    expect(await make(config(), { count: jest.fn().mockResolvedValue(1) }).isEnabled('a')).toBe(
      true,
    );
    expect(await make(config(), { count: jest.fn().mockResolvedValue(0) }).isEnabled('a')).toBe(
      false,
    );
  });

  describe('tryHeal', () => {
    it('returns null and does not call out when not configured', async () => {
      const fetchMock = jest.fn();
      (global as { fetch?: unknown }).fetch = fetchMock;
      const result = await make(config({ 'app.healingApiUrl': '' })).tryHeal(ctx());
      expect(result).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('applies returned operations to the body and yields an outcome token', async () => {
      const fetchMock = fetchOk({
        outcome: 'patch',
        patchRef: 'p1',
        issueRef: 'i1',
        operations: [{ type: 'remap_model', from: 'gpt-4-vision-preview', to: 'gpt-4o' }],
      });
      (global as { fetch?: unknown }).fetch = fetchMock;

      const result = await make().tryHeal(ctx());

      expect(result).not.toBeNull();
      expect(result!.body.model).toBe('gpt-4o');
      expect(result!.token).toEqual({
        requestId: 'req-1',
        patchRef: 'p1',
        issueRef: 'i1',
        tenantId: 'tenant-1',
        agentId: 'agent-1',
      });
      // Structural, content-free payload.
      const sent = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body);
      expect(sent.request.params).toEqual({ temperature: 0.5 });
      expect(sent.request.messages).toEqual([{ role: 'user', bytes: 4 }]);
      expect(sent.error).toEqual({
        statusCode: 404,
        type: 'not_found_error',
        code: 'model_not_found',
        param: 'model',
        message: 'deprecated',
      });
      expect(
        (fetchMock.mock.calls[0][1] as { headers: Record<string, string> }).headers.authorization,
      ).toBe('Bearer tok');
    });

    it('returns null for a non-patch outcome', async () => {
      (global as { fetch?: unknown }).fetch = fetchOk({
        outcome: 'unpatchable',
        issueRef: null,
        reason: 'no_known_fix',
      });
      expect(await make().tryHeal(ctx())).toBeNull();
    });

    it('returns null when an operation is outside the catalog', async () => {
      (global as { fetch?: unknown }).fetch = fetchOk({
        outcome: 'patch',
        patchRef: 'p',
        issueRef: 'i',
        operations: [{ type: 'definitely_not_real' }],
      });
      expect(await make().tryHeal(ctx())).toBeNull();
    });

    it('returns null on a non-2xx heal response', async () => {
      (global as { fetch?: unknown }).fetch = jest
        .fn()
        .mockResolvedValue({ ok: false, json: jest.fn() });
      expect(await make().tryHeal(ctx())).toBeNull();
    });

    it('returns null when the heal call throws', async () => {
      (global as { fetch?: unknown }).fetch = jest.fn().mockRejectedValue(new Error('network'));
      expect(await make().tryHeal(ctx())).toBeNull();
    });

    it('strips tool descriptions and tolerates a non-JSON error body and odd messages', async () => {
      const fetchMock = fetchOk({
        outcome: 'patch',
        patchRef: 'p',
        issueRef: 'i',
        operations: [{ type: 'drop_param', param: 'temperature' }],
      });
      (global as { fetch?: unknown }).fetch = fetchMock;
      await make(config({ 'app.healingApiToken': '' })).tryHeal(
        ctx({
          errorBodyText: 'not json at all',
          body: {
            model: 'gpt-4o',
            messages: [
              { role: 7 as unknown as string, content: 'x' },
              'weird' as unknown as Record<string, unknown>,
            ],
            tools: [
              {
                type: 'function',
                function: {
                  name: 'f',
                  description: 'secret',
                  parameters: { type: 'object', description: 'd' },
                },
              },
            ],
          },
        }),
      );
      const sent = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body);
      expect(sent.request.tools[0].function.description).toBeUndefined();
      expect(sent.request.tools[0].function.parameters.description).toBeUndefined();
      expect(sent.request.messages[0].role).toBe('unknown');
      expect(sent.error.message).toBe('not json at all');
      // No token configured => no Authorization header.
      expect(
        (fetchMock.mock.calls[0][1] as { headers: Record<string, string> }).headers.authorization,
      ).toBeUndefined();
    });

    it('parses a top-level error object and defaults the timeout', async () => {
      const fetchMock = fetchOk({
        outcome: 'patch',
        patchRef: 'p',
        issueRef: 'i',
        operations: [{ type: 'drop_param', param: 'x' }],
      });
      (global as { fetch?: unknown }).fetch = fetchMock;
      await make(config({ 'app.healingTimeoutMs': undefined })).tryHeal(
        ctx({ errorBodyText: JSON.stringify({ message: 'top level', type: 'e' }) }),
      );
      const sent = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body);
      expect(sent.error.message).toBe('top level');
      expect(sent.maxWaitMs).toBe(3000);
    });
  });

  describe('reportOutcome', () => {
    const token = { requestId: 'r', patchRef: 'p', issueRef: 'i', tenantId: 't', agentId: 'a' };

    it('posts the outcome when configured', async () => {
      const fetchMock = jest.fn().mockResolvedValue({ ok: true });
      (global as { fetch?: unknown }).fetch = fetchMock;
      await make().reportOutcome(token, 'healed');
      expect(fetchMock).toHaveBeenCalledWith(
        'http://healer.test/heal/outcome',
        expect.objectContaining({ method: 'POST' }),
      );
      expect(JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body)).toMatchObject({
        outcome: 'healed',
        mode: 'post_error',
        patchRef: 'p',
      });
    });

    it('no-ops when not configured', async () => {
      const fetchMock = jest.fn();
      (global as { fetch?: unknown }).fetch = fetchMock;
      await make(config({ 'app.healingApiUrl': '' })).reportOutcome(token, 'failed');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('swallows report errors', async () => {
      (global as { fetch?: unknown }).fetch = jest.fn().mockRejectedValue(new Error('down'));
      await expect(make().reportOutcome(token, 'failed')).resolves.toBeUndefined();
    });
  });
});
