import { ConfigService } from '@nestjs/config';
import { ObservationReporter } from './observation-reporter';
import type { HealingClient } from './healing-client';
import type { ObservationInput } from './observation-payload';

function makeConfig(values: Record<string, string> = {}): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

function makeClient(): jest.Mocked<HealingClient> {
  return {
    observe: jest.fn().mockResolvedValue(undefined),
    heal: jest.fn(),
    reportOutcome: jest.fn(),
  } as unknown as jest.Mocked<HealingClient>;
}

const input: ObservationInput = {
  traceId: 'trace-1',
  tenantId: 'tenant-1',
  provider: 'openai',
  apiMode: 'chat_completions',
  requestBody: { model: 'gpt-5.1', messages: [{ role: 'user', content: 'hi' }] },
  status: 400,
  errorBody: '{"error":{"message":"bad request"}}',
};

function enabledReporter(client: HealingClient): ObservationReporter {
  return new ObservationReporter(client, makeConfig({ AUTOFIX_REPORT_ALL_4XX: 'true' }));
}

describe('ObservationReporter', () => {
  afterEach(() => jest.useRealTimers());

  it('does nothing when the feed is disabled', async () => {
    const client = makeClient();
    const reporter = new ObservationReporter(client, makeConfig());
    reporter.report(input);
    await reporter.flush();
    expect(client.observe).not.toHaveBeenCalled();
  });

  it('never reports a non-request-side failure', async () => {
    const client = makeClient();
    const reporter = enabledReporter(client);
    reporter.report({ ...input, status: 401 });
    await reporter.flush();
    expect(client.observe).not.toHaveBeenCalled();
  });

  it('sends a queued observation with the full body on flush', async () => {
    const client = makeClient();
    const reporter = enabledReporter(client);
    reporter.report(input);
    await reporter.flush();
    expect(client.observe).toHaveBeenCalledTimes(1);
    const [batch] = client.observe.mock.calls[0];
    expect(batch).toHaveLength(1);
    expect(batch[0].request.messages).toEqual([{ role: 'user', content: 'hi' }]);
  });

  it('flushes automatically once a full batch accumulates', async () => {
    const client = makeClient();
    const reporter = enabledReporter(client);
    for (let i = 0; i < 50; i++) reporter.report({ ...input, traceId: `trace-${i}` });
    await Promise.resolve();
    expect(client.observe).toHaveBeenCalledTimes(1);
    expect(client.observe.mock.calls[0][0]).toHaveLength(50);
  });

  it('flushes on the timer when the batch never fills', async () => {
    jest.useFakeTimers();
    const client = makeClient();
    const reporter = enabledReporter(client);
    reporter.report(input);
    expect(client.observe).not.toHaveBeenCalled();
    jest.advanceTimersByTime(2_000);
    await Promise.resolve();
    expect(client.observe).toHaveBeenCalledTimes(1);
  });

  it('bounds the queue at 500, dropping the oldest observations first', () => {
    const client = makeClient();
    const reporter = enabledReporter(client);
    // Stub the drain so the queue actually reaches the cap; otherwise the
    // batch-full auto-flush empties it long before any observation is dropped.
    jest.spyOn(reporter, 'flush').mockResolvedValue(undefined);
    for (let i = 0; i < 601; i++) reporter.report({ ...input, traceId: `trace-${i}` });
    const queue = reporter['queue'];
    expect(queue).toHaveLength(500);
    // 101 dropped off the front; the newest is still there.
    expect(queue[0].traceId).toBe('trace-101');
    expect(queue[queue.length - 1].traceId).toBe('trace-600');
  });

  it('keeps flushing while more than one batch is queued', async () => {
    jest.useFakeTimers();
    const client = makeClient();
    const reporter = enabledReporter(client);
    // Fill past one batch without letting the batch-full auto-flush drain it.
    const drain = jest.spyOn(reporter, 'flush').mockResolvedValue(undefined);
    for (let i = 0; i < 120; i++) reporter.report({ ...input, traceId: `trace-${i}` });
    drain.mockRestore();

    await reporter.flush();
    expect(client.observe).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(2_000);
    expect(client.observe).toHaveBeenCalledTimes(2);
  });

  it('never throws when a body cannot be serialized', () => {
    const client = makeClient();
    const reporter = enabledReporter(client);
    const circular: Record<string, unknown> = { model: 'gpt-5.1' };
    circular.self = circular;
    expect(() => reporter.report({ ...input, requestBody: circular })).not.toThrow();
    expect(client.observe).not.toHaveBeenCalled();
  });

  it('swallows a healer failure so the proxy never sees it', async () => {
    const client = makeClient();
    client.observe.mockRejectedValue(new Error('phoenix down'));
    const reporter = enabledReporter(client);
    reporter.report(input);
    await expect(reporter.flush()).resolves.toBeUndefined();
  });

  it('drains the queue on shutdown', async () => {
    const client = makeClient();
    const reporter = enabledReporter(client);
    reporter.report(input);
    await reporter.onModuleDestroy();
    expect(client.observe).toHaveBeenCalledTimes(1);
  });

  it('is a no-op flush when nothing is queued', async () => {
    const client = makeClient();
    const reporter = enabledReporter(client);
    await reporter.flush();
    expect(client.observe).not.toHaveBeenCalled();
  });
});
