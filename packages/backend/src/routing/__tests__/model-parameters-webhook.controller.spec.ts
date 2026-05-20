import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, ServiceUnavailableException } from '@nestjs/common';
import { createHmac } from 'crypto';
import type { Request } from 'express';
import { ModelParametersWebhookController } from '../model-parameters-webhook.controller';
import { ProviderParamSpecService } from '../routing-core/provider-param-spec.service';

type RawBodyRequest = Request & { rawBody?: Buffer };

describe('ModelParametersWebhookController', () => {
  const secret = 'webhook-secret';
  let controller: ModelParametersWebhookController;
  let providerParamSpecs: Pick<ProviderParamSpecService, 'refreshCache' | 'getLastFetchedAt'>;
  let config: Pick<ConfigService, 'get'>;

  beforeEach(() => {
    providerParamSpecs = {
      refreshCache: jest.fn().mockResolvedValue(59),
      getLastFetchedAt: jest.fn().mockReturnValue(new Date('2026-05-20T12:00:00.000Z')),
    };
    config = {
      get: jest.fn().mockReturnValue(secret),
    };
    controller = new ModelParametersWebhookController(
      providerParamSpecs as ProviderParamSpecService,
      config as ConfigService,
    );
  });

  function signedRequest(payload: unknown): {
    body: unknown;
    request: RawBodyRequest;
    signature: string;
  } {
    const rawBody = Buffer.from(JSON.stringify(payload));
    return {
      body: payload,
      request: { rawBody } as RawBodyRequest,
      signature: 'sha256=' + createHmac('sha256', secret).update(rawBody).digest('hex'),
    };
  }

  function mergedModelParametersPayload() {
    return {
      action: 'closed',
      repository: { full_name: 'mnfst/modelparameters.dev' },
      pull_request: {
        merged: true,
        base: { ref: 'main' },
      },
    };
  }

  it('refreshes the MPS cache for a merged modelparameters.dev PR', async () => {
    const { body, request, signature } = signedRequest(mergedModelParametersPayload());

    await expect(
      controller.handleGithubWebhook(request, signature, 'pull_request', body),
    ).resolves.toEqual({
      ok: true,
      refreshed: true,
      model_count: 59,
      last_fetched_at: '2026-05-20T12:00:00.000Z',
    });
    expect(providerParamSpecs.refreshCache).toHaveBeenCalledTimes(1);
  });

  it('ignores non-merged pull request events', async () => {
    const { body, request, signature } = signedRequest({
      ...mergedModelParametersPayload(),
      action: 'opened',
    });

    await expect(
      controller.handleGithubWebhook(request, signature, 'pull_request', body),
    ).resolves.toEqual({
      ok: true,
      ignored: true,
      reason: 'not_modelparameters_merge',
    });
    expect(providerParamSpecs.refreshCache).not.toHaveBeenCalled();
  });

  it('ignores unsupported GitHub events', async () => {
    const { body, request, signature } = signedRequest({ zen: 'Keep it logically awesome.' });

    await expect(controller.handleGithubWebhook(request, signature, 'ping', body)).resolves.toEqual(
      {
        ok: true,
        ignored: true,
        reason: 'unsupported_event',
      },
    );
    expect(providerParamSpecs.refreshCache).not.toHaveBeenCalled();
  });

  it('rejects invalid webhook signatures', async () => {
    const { body, request } = signedRequest(mergedModelParametersPayload());

    await expect(
      controller.handleGithubWebhook(request, 'sha256=bad', 'pull_request', body),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(providerParamSpecs.refreshCache).not.toHaveBeenCalled();
  });

  it('fails closed when no webhook secret is configured', async () => {
    (config.get as jest.Mock).mockReturnValue('');
    const { body, request, signature } = signedRequest(mergedModelParametersPayload());

    await expect(
      controller.handleGithubWebhook(request, signature, 'pull_request', body),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(providerParamSpecs.refreshCache).not.toHaveBeenCalled();
  });
});
