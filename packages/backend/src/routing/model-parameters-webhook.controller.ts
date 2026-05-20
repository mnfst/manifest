import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  Req,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import type { Request } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { ProviderParamSpecService } from './routing-core/provider-param-spec.service';

const GITHUB_SIGNATURE_PREFIX = 'sha256=';
const MODELPARAMETERS_REPO = 'mnfst/modelparameters.dev';
const MODELPARAMETERS_BASE_BRANCH = 'main';

type RawBodyRequest = Request & { rawBody?: Buffer };

@Controller('api/v1/webhooks/model-parameters')
export class ModelParametersWebhookController {
  constructor(
    private readonly providerParamSpecs: ProviderParamSpecService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post('github')
  @HttpCode(200)
  async handleGithubWebhook(
    @Req() request: RawBodyRequest,
    @Headers('x-hub-signature-256') signature: string | string[] | undefined,
    @Headers('x-github-event') event: string | string[] | undefined,
    @Body() body: unknown,
  ) {
    this.assertValidSignature(request.rawBody, signature);

    if (event !== 'pull_request') {
      return { ok: true, ignored: true, reason: 'unsupported_event' };
    }

    if (!isMergedModelParametersPullRequest(body)) {
      return { ok: true, ignored: true, reason: 'not_modelparameters_merge' };
    }

    const modelCount = await this.providerParamSpecs.refreshCache();
    return {
      ok: modelCount > 0,
      refreshed: modelCount > 0,
      model_count: modelCount,
      last_fetched_at: this.providerParamSpecs.getLastFetchedAt()?.toISOString() ?? null,
    };
  }

  private assertValidSignature(
    rawBody: Buffer | undefined,
    signature: string | string[] | undefined,
  ): void {
    const secret = this.config.get<string>('app.modelParametersWebhookSecret', '');
    if (!secret) {
      throw new ServiceUnavailableException('Model parameters webhook is not configured');
    }
    if (typeof signature !== 'string' || !signature.startsWith(GITHUB_SIGNATURE_PREFIX)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
    if (!rawBody) {
      throw new BadRequestException('Missing raw request body');
    }

    const expected =
      GITHUB_SIGNATURE_PREFIX + createHmac('sha256', secret).update(rawBody).digest('hex');
    if (!safeCompare(signature, expected)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
  }
}

function isMergedModelParametersPullRequest(body: unknown): boolean {
  if (!isRecord(body)) return false;
  if (body.action !== 'closed') return false;

  const repository = isRecord(body.repository) ? body.repository : null;
  if (repository?.full_name !== MODELPARAMETERS_REPO) return false;

  const pullRequest = isRecord(body.pull_request) ? body.pull_request : null;
  if (pullRequest?.merged !== true) return false;

  const base = isRecord(pullRequest.base) ? pullRequest.base : null;
  return base?.ref === MODELPARAMETERS_BASE_BRANCH;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function safeCompare(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, 'utf8');
  const bBuf = Buffer.from(b, 'utf8');
  return aBuf.length === bBuf.length && timingSafeEqual(aBuf, bBuf);
}
