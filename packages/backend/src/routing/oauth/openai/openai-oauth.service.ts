import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProviderService } from '../../routing-core/provider.service';
import { ModelDiscoveryService } from '../../../model-discovery/model-discovery.service';
import { PendingOAuth } from './openai-oauth.types';
import { oauthDoneHtml, type OAuthTokenBlob } from '../core';
import { RedirectPkceOauthBaseService } from '../core/redirect-pkce-oauth.base';

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
}
