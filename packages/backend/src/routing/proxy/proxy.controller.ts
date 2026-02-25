import {
  Controller,
  Post,
  Req,
  Res,
  UseGuards,
  Logger,
  HttpException,
} from '@nestjs/common';
import { Request, Response as ExpressResponse } from 'express';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { OtlpAuthGuard } from '../../otlp/guards/otlp-auth.guard';
import { IngestionContext } from '../../otlp/interfaces/ingestion-context.interface';
import { ProxyService } from './proxy.service';
import { ProviderClient } from './provider-client';
import { initSseHeaders, pipeStream } from './stream-writer';
import { trackCloudEvent } from '../../common/utils/product-telemetry';

@Controller('v1')
@Public()
@UseGuards(OtlpAuthGuard)
@SkipThrottle()
export class ProxyController {
  private readonly logger = new Logger(ProxyController.name);
  private readonly seenUsers = new Set<string>();

  constructor(
    private readonly proxyService: ProxyService,
    private readonly providerClient: ProviderClient,
  ) {}

  @Post('chat/completions')
  async chatCompletions(
    @Req() req: Request & { ingestionContext: IngestionContext },
    @Res() res: ExpressResponse,
  ): Promise<void> {
    const { userId } = req.ingestionContext;
    const body = req.body as Record<string, unknown>;
    const sessionKey = (req.headers['x-session-key'] as string) || 'default';
    const isStream = body.stream === true;
    let headersSent = false;

    try {
      const { forward, meta } = await this.proxyService.proxyRequest(
        userId,
        body,
        sessionKey,
      );

      this.trackFirstProxyRequest(userId, meta);

      const metaHeaders: Record<string, string> = {
        'X-Manifest-Tier': meta.tier,
        'X-Manifest-Model': meta.model,
        'X-Manifest-Provider': meta.provider,
        'X-Manifest-Confidence': String(meta.confidence),
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

        if (forward.isGoogle) {
          await pipeStream(
            providerResponse.body,
            res,
            (chunk) => this.providerClient.convertGoogleStreamChunk(chunk, meta.model),
          );
        } else {
          await pipeStream(providerResponse.body, res);
        }
      } else {
        let responseBody: unknown;

        if (forward.isGoogle) {
          const googleData = await providerResponse.json() as Record<string, unknown>;
          responseBody = this.providerClient.convertGoogleResponse(googleData, meta.model);
        } else {
          responseBody = await providerResponse.json();
        }

        res.status(200);
        for (const [k, v] of Object.entries(metaHeaders)) res.setHeader(k, v);
        res.json(responseBody);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const status = err instanceof HttpException ? err.getStatus() : 500;
      this.logger.error(`Proxy error: ${message}`);

      if (headersSent) {
        // Headers already flushed for SSE — just close the stream
        if (!res.writableEnded) res.end();
        return;
      }

      const clientMessage = status >= 500 ? 'Internal proxy error' : message;
      res.status(status).json({
        error: { message: clientMessage, type: 'proxy_error' },
      });
    }
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
