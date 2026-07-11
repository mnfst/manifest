import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProviderService } from '../../routing-core/provider.service';
import { ModelDiscoveryService } from '../../../model-discovery/model-discovery.service';
import { PendingOAuth } from './openai-oauth.types';
import { oauthDoneHtml, parseOAuthTokenBlob, type OAuthTokenBlob } from '../core';
import {
  RedirectPkceOauthBaseService,
  type OAuthTokenResponse,
} from '../core/redirect-pkce-oauth.base';
import {
  extractOpenAiSubscriptionMetadata,
  parseOpenAiSubscriptionMetadata,
  serializeOpenAiSubscriptionMetadata,
  type OpenAiSubscriptionMetadata,
} from './openai-token-metadata';

export { PendingOAuth };
export { oauthDoneHtml, type OAuthTokenBlob };

const DEFAULT_CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann';

@Injectable()
export class OpenaiOauthService extends RedirectPkceOauthBaseService {
  constructor(
    providerService: ProviderService,
    configService: ConfigService,
    discoveryService: ModelDiscoveryService,
  ) {
    super(providerService, configService, discoveryService, {
      providerId: 'openai',
      serviceName: OpenaiOauthService.name,
      defaultClientId: DEFAULT_CLIENT_ID,
      clientIdEnvVar: 'OPENAI_OAUTH_CLIENT_ID',
      authorizeUrl: 'https://auth.openai.com/oauth/authorize',
      tokenUrl: 'https://auth.openai.com/oauth/token',
      revokeUrl: 'https://auth.openai.com/oauth/revoke',
      scope: 'openid profile email offline_access',
      callbackPort: 1455,
    });
  }

  protected extractTokenMetadata(response: OAuthTokenResponse): string | undefined {
    const metadata = extractOpenAiSubscriptionMetadata(response.id_token ?? response.access_token);
    return serializeOpenAiSubscriptionMetadata(metadata);
  }

  async unwrapTokenWithMetadata(
    rawValue: string,
    agentId: string,
    tenantId: string,
    keyLabel?: string,
  ): Promise<{ accessToken: string; metadata: OpenAiSubscriptionMetadata } | null> {
    const originalBlob = parseOAuthTokenBlob(rawValue);
    if (!originalBlob) return null;
    const wasFresh = Date.now() < originalBlob.e - 60_000;
    const accessToken = await this.unwrapToken(rawValue, agentId, tenantId, keyLabel);
    if (!accessToken) return null;

    let currentBlob = originalBlob;
    if (!wasFresh) {
      const freshRaw = await this.providerService.getFreshSubscriptionCredential(
        tenantId,
        'openai',
        keyLabel,
      );
      currentBlob = (freshRaw && parseOAuthTokenBlob(freshRaw)) || originalBlob;
    }
    const metadata = {
      ...extractOpenAiSubscriptionMetadata(accessToken),
      ...parseOpenAiSubscriptionMetadata(currentBlob.m),
    };
    return { accessToken, metadata };
  }
}
