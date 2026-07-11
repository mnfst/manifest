import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AutofixHealthProbe } from '../autofix-health-probe';

function makeConfig(overrides: Record<string, string | undefined> = {}): ConfigService {
  return { get: jest.fn((key: string) => overrides[key]) } as unknown as ConfigService;
}

function makeProbe(overrides: Record<string, string | undefined> = {}): AutofixHealthProbe {
  return new AutofixHealthProbe(makeConfig(overrides));
}

function fakeResponse(ok: boolean, status: number): Response {
  return { ok, status } as unknown as Response;
}

describe('AutofixHealthProbe', () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does nothing when AUTOFIX_HEALING_URL is unset', async () => {
    await makeProbe({}).probe();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does nothing when AUTOFIX_HEALING_URL is blank/whitespace', async () => {
    await makeProbe({ AUTOFIX_HEALING_URL: '   ' }).probe();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('pings `${url}/api/health` and logs success on 2xx (trailing slash stripped)', async () => {
    fetchSpy.mockResolvedValue(fakeResponse(true, 200));
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    await makeProbe({ AUTOFIX_HEALING_URL: 'http://phoenix.local/' }).probe();

    expect(fetchSpy.mock.calls[0][0]).toBe('http://phoenix.local/api/health');
    expect(logSpy).toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('warns on a non-2xx health response', async () => {
    fetchSpy.mockResolvedValue(fakeResponse(false, 503));
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    await makeProbe({ AUTOFIX_HEALING_URL: 'http://phoenix.local' }).probe();

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('503'));
  });

  it('warns (never throws) when the probe fetch rejects', async () => {
    fetchSpy.mockRejectedValue(new Error('ECONNREFUSED'));
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    await expect(
      makeProbe({ AUTOFIX_HEALING_URL: 'http://phoenix.local' }).probe(),
    ).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('ECONNREFUSED'));
  });

  it('never sends x-api-key to the public health endpoint, even when a key is set', async () => {
    fetchSpy.mockResolvedValue(fakeResponse(true, 200));
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

    await makeProbe({
      AUTOFIX_HEALING_URL: 'http://phoenix.local',
      AUTOFIX_HEALING_API_KEY: 'secret',
    }).probe();

    // /api/health is public in the Phoenix contract; the probe must not attach
    // the key (a wrong/misconfigured URL would otherwise leak it).
    expect(fetchSpy.mock.calls[0][1].headers).toBeUndefined();
  });

  it('onApplicationBootstrap fires the probe without awaiting it', () => {
    const probe = makeProbe({});
    const spy = jest.spyOn(probe, 'probe').mockResolvedValue(undefined);

    probe.onApplicationBootstrap();

    expect(spy).toHaveBeenCalledTimes(1);
  });
});
