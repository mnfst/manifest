import { Injectable, Logger } from '@nestjs/common';
import { ProviderService } from '../routing-core/provider.service';
import { ModelDiscoveryService } from '../../model-discovery/model-discovery.service';
import {
  getFreshKiroCliToken,
  parseKiroCliTokenBlob,
  serializeKiroCliTokenBlob,
} from './kiro-cli-token';

export interface KiroCliConnectResult {
  ok: true;
  expiresAt: string;
  authMethod?: string;
  provider?: string;
}

@Injectable()
export class KiroOauthService {
  private readonly logger = new Logger(KiroOauthService.name);

  constructor(
    private readonly providerService: ProviderService,
    private readonly discoveryService: ModelDiscoveryService,
  ) {}

  async connectFromCli(agentId: string, userId: string): Promise<KiroCliConnectResult> {
    const token = await getFreshKiroCliToken();
    const { provider: savedProvider } = await this.providerService.upsertProvider(
      agentId,
      userId,
      'kiro',
      serializeKiroCliTokenBlob(token),
      'subscription',
    );
    try {
      await this.discoveryService.discoverModels(savedProvider);
      await this.providerService.recalculateTiers(agentId);
    } catch (err) {
      this.logger.warn(`Model discovery after Kiro CLI OAuth failed: ${err}`);
    }
    return {
      ok: true,
      expiresAt: new Date(token.e).toISOString(),
      ...(token.authMethod ? { authMethod: token.authMethod } : {}),
      ...(token.provider ? { provider: token.provider } : {}),
    };
  }

  async unwrapToken(rawValue: string, agentId: string, userId: string): Promise<string | null> {
    const blob = parseKiroCliTokenBlob(rawValue);
    if (!blob) return null;
    if (Date.now() < blob.e - 60_000) return blob.t;

    try {
      const refreshed = await getFreshKiroCliToken();
      await this.providerService.upsertProvider(
        agentId,
        userId,
        'kiro',
        serializeKiroCliTokenBlob(refreshed),
        'subscription',
      );
      this.logger.log(`Kiro CLI OAuth token refreshed for agent=${agentId}`);
      return refreshed.t;
    } catch (err) {
      this.logger.error(`Failed to refresh Kiro CLI OAuth token for agent=${agentId}: ${err}`);
      return Date.now() < blob.e ? blob.t : null;
    }
  }
}
