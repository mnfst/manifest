import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProviderService } from '../../routing-core/provider.service';
import { ModelDiscoveryService } from '../../../model-discovery/model-discovery.service';
import { RedirectPkceOauthBaseService } from '../core/redirect-pkce-oauth.base';

const DEFAULT_CLIENT_ID = 'b1a00492-073a-47ea-816f-4c329264a828';
const CALLBACK_PORT = 56121;

@Injectable()
export class XaiOauthService extends RedirectPkceOauthBaseService {
  constructor(
    providerService: ProviderService,
    configService: ConfigService,
    discoveryService: ModelDiscoveryService,
  ) {
    super(providerService, configService, discoveryService, {
      providerId: 'xai',
      serviceName: XaiOauthService.name,
      defaultClientId: DEFAULT_CLIENT_ID,
      clientIdEnvVar: 'XAI_OAUTH_CLIENT_ID',
      authorizeUrl: 'https://auth.x.ai/oauth2/authorize',
      tokenUrl: 'https://auth.x.ai/oauth2/token',
      revokeUrl: 'https://auth.x.ai/oauth2/revoke',
      scope: 'openid profile email offline_access grok-cli:access api:access',
      callbackPort: CALLBACK_PORT,
      // xAI's OAuth client is registered with a 127.0.0.1 redirect on a
      // bare /callback path, and its endpoints want an explicit Accept.
      redirectUri: `http://127.0.0.1:${CALLBACK_PORT}/callback`,
      callbackPath: '/callback',
      includeNonce: true,
      extraTokenHeaders: { Accept: 'application/json' },
      providerLabel: 'xAI Login',
    });
  }
}
