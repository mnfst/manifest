import {
  Controller,
  Post,
  Req,
  Res,
  UseGuards,
  Logger,
  HttpException,
  BadRequestException,
} from '@nestjs/common';
import { Request, Response as ExpressResponse } from 'express';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { OtlpAuthGuard } from '../../otlp/guards/otlp-auth.guard';
import { IngestionContext } from '../../otlp/interfaces/ingestion-context.interface';
import { ProxyService } from './proxy.service';
import { initSseHeaders, pipeStream } from './stream-writer';
import { trackCloudEvent } from '../../common/utils/product-telemetry';
import { TIERS, Tier } from '../scorer/types';

@Controller('v1')
@Public()
@UseGuards(OtlpAuthGuard)
@SkipThrottle()
export class ProxyController {
  private readonly logger = new Logger(ProxyController.name);
  private readonly seenUsers = new Set<string>();

  constructor(private readonly proxyService: ProxyService) {}

  @Post('chat/completions')
  async chatCompletions(
    @Req() req: Request & { ingestionContext: IngestionContext },
    @Res() res: ExpressResponse,
  ): Promise<void> {
    const { userId } = req.ingestionContext;
    const body = req.body as Record<string, unknown>;
    const isStream = body.stream === true;
    let headersSent = false;

    try {
      const tier = this.extractTier(req);

      const { forward, meta } = await this.proxyService.proxyRequest(
        userId,
        body,
        tier,
      );

      this.trackFirstProxyRequest(userId, meta);

      const metaHeaders: Record<string, string> = {
        'X-Manifest-Tier': meta.tier,
        'X-Manifest-Model': meta.model,
        'X-Manifest-Provider': meta.provider,
      };

      const providerResponse = forward.response;

      if (!providerResponse.ok) {
        const errorBody = await providerResponse.text();
        res.status(providerResponse.status);
        for (const [k, v] of Object.entries(metaHeaders)) res.setHeader(k, v);
        const contentType = providerResponse.headers.get('content-type');
        if (contentType) res.setHeader('Content-Type', contentType);
        res.send(errorBody);
        return;
      }

      if (isStream && providerResponse.body) {
        initSseHeaders(res, metaHeaders);
        headersSent = true;
        await pipeStream(providerResponse.body, res);
      } else {
        const responseBody = await providerResponse.json();
        res.status(200);
        for (const [k, v] of Object.entries(metaHeaders)) res.setHeader(k, v);
        res.json(responseBody);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const status = err instanceof HttpException ? err.getStatus() : 500;
      this.logger.error(`Proxy error: ${message}`);

      if (headersSent) {
        if (!res.writableEnded) res.end();
        return;
      }

      const clientMessage = status >= 500 ? 'Internal proxy error' : message;
      res.status(status).json({
        error: { message: clientMessage, type: 'proxy_error' },
      });
    }
  }

  private extractTier(req: Request): Tier {
    const tierHeader = req.headers['x-manifest-tier'] as string | undefined;
    if (!tierHeader) return 'standard';

    const tier = tierHeader.toLowerCase();
    if (!TIERS.includes(tier as Tier)) {
      throw new BadRequestException(
        `Invalid tier "${tierHeader}". Must be one of: ${TIERS.join(', ')}`,
      );
    }
    return tier as Tier;
  }

  private trackFirstProxyRequest(
    userId: string,
    meta: { provider: string; model: string; tier: string },
  ): void {
    if (this.seenUsers.has(userId)) return;
    this.seenUsers.add(userId);
    trackCloudEvent('routing_first_proxy_request', userId, {
      provider: meta.provider,
      model: meta.model,
      tier: meta.tier,
    });
  }
}
