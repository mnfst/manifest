import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ResolveService } from '../resolve.service';
import { RoutingService } from '../routing.service';
import { ProviderClient, ForwardResult } from './provider-client';
import { Tier } from '../scorer/types';

export interface RoutingMeta {
  tier: Tier;
  model: string;
  provider: string;
}

export interface ProxyResult {
  forward: ForwardResult;
  meta: RoutingMeta;
}

@Injectable()
export class ProxyService {
  private readonly logger = new Logger(ProxyService.name);

  constructor(
    private readonly resolveService: ResolveService,
    private readonly routingService: RoutingService,
    private readonly providerClient: ProviderClient,
  ) {}

  async proxyRequest(
    userId: string,
    body: Record<string, unknown>,
    tier: Tier,
  ): Promise<ProxyResult> {
    const stream = body.stream === true;

    const resolved = await this.resolveService.resolveForTier(userId, tier);

    if (!resolved.model || !resolved.provider) {
      throw new BadRequestException(
        `No model available for tier "${tier}". Connect a provider in the Manifest dashboard.`,
      );
    }

    const apiKey = await this.routingService.getProviderApiKey(
      userId,
      resolved.provider,
    );
    if (apiKey === null) {
      throw new BadRequestException(
        `No API key found for provider: ${resolved.provider}. Re-connect the provider with an API key.`,
      );
    }

    this.logger.log(
      `Proxy: tier=${tier} model=${resolved.model} provider=${resolved.provider}`,
    );

    const forward = await this.providerClient.forward(
      resolved.provider,
      apiKey,
      resolved.model,
      body,
      stream,
    );

    return {
      forward,
      meta: {
        tier,
        model: resolved.model,
        provider: resolved.provider,
      },
    };
  }
}
