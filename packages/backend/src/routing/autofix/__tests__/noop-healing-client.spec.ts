import { NoopHealingClient } from '../noop-healing-client';
import type { HealRequest } from '../phoenix.types';

describe('NoopHealingClient', () => {
  const client = new NoopHealingClient();

  const sampleRequest: HealRequest = {
    traceId: 'trace-1',
    tenantId: 'tenant-1',
    provider: 'anthropic',
    authType: 'subscription',
    api: 'chat_completions',
    request: { model: 'gpt', max_tokens: 100 },
    response: { statusCode: 400, error: { message: 'boom' } },
  };

  it('heal() always returns no_patch and never hands out a patch', async () => {
    const res = await client.heal(sampleRequest);

    expect(res.status).toBe('no_patch');
    expect(res.issueId).toBe('autofix-noop');
    // No healedBody / healAttemptId → the loop treats it as unfixable and never
    // resends a mutated request.
    expect(res.healedBody).toBeUndefined();
    expect(res.healAttemptId).toBeUndefined();
  });

  it('reportOutcome() is a no-op that resolves null', async () => {
    await expect(client.reportOutcome('heal-1', { retryStatusCode: 200 })).resolves.toBeNull();
  });

  it('observe() discards the batch without reaching a healer', async () => {
    await expect(client.observe([sampleRequest])).resolves.toBeUndefined();
  });
});
