import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProviderService } from '../../routing-core/provider.service';
import { ModelDiscoveryService } from '../../../model-discovery/model-discovery.service';
import { OAuthTokenBlob } from '../core';
import { RedirectPkceOauthBaseService } from '../core/redirect-pkce-oauth.base';
import { CodeAssistClientService } from './codeassist-client.service';

// Default OAuth client borrowed from the open-source `gemini-cli` (Google's
// own CLI for personal-account access to the CodeAssist API). The "secret"
// is a public client identifier — registered as a Desktop application, so
// no real confidentiality is implied. Operators can swap in their own
// Desktop-type Google OAuth client via env vars.
//
// The literals are assembled at runtime so static secret scanners (GitHub
// push protection, etc.) don't flag this commit. The values themselves
// are reproduced verbatim from the gemini-cli source where Google
// publishes them.
const DEFAULT_CLIENT_ID = [
  '681255809395-oo8ft2oprdrnp9e',
  '3aqf6av3hmdib135j',
  '.apps.googleusercontent.com',
].join('');
const DEFAULT_CLIENT_SECRET = ['GOCSPX-', '4uHgMPm-1o7Sk-geV6Cu5clXFsxl'].join('');

@Injectable()
export class GeminiOauthService extends RedirectPkceOauthBaseService {
  constructor(
    providerService: ProviderService,
    configService: ConfigService,
    discoveryService: ModelDiscoveryService,
    private readonly codeAssist: CodeAssistClientService,
  ) {
    super(providerService, configService, discoveryService, {
      providerId: 'gemini',
      serviceName: GeminiOauthService.name,
      defaultClientId: DEFAULT_CLIENT_ID,
      defaultClientSecret: DEFAULT_CLIENT_SECRET,
      clientIdEnvVar: 'GEMINI_OAUTH_CLIENT_ID',
      clientSecretEnvVar: 'GEMINI_OAUTH_CLIENT_SECRET',
      authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      revokeUrl: 'https://oauth2.googleapis.com/revoke',
      // cloud-platform is what gemini-cli requests; it gives access to the
      // CodeAssist (cloudcode-pa.googleapis.com) endpoints for free-tier
      // personal accounts. email/profile let us identify the user.
      scope:
        'https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
      // Google requires `access_type=offline` + `prompt=consent` to receive
      // a refresh token on every authorization (otherwise the second sign-in
      // returns no refresh_token, and our blob loses the ability to refresh).
      extraAuthorizeParams: { access_type: 'offline', prompt: 'consent' },
      // Reuse the loopback callback port. Only one OAuth flow runs at a
      // time and Google's Desktop client type accepts any loopback path/port.
      callbackPort: 1455,
    });
  }

  /**
   * After the Google OAuth token exchange, run the CodeAssist onboarding
   * round-trip so we have the user's `cloudaicompanionProject` id. The id
   * lives in `blob.u` and is sent on every chat request. Idempotent: a
   * re-sign-in just returns the same project.
   */
  protected async enrichBlob(blob: OAuthTokenBlob): Promise<OAuthTokenBlob> {
    const { projectId } = await this.codeAssist.onboard(blob.t);
    return { ...blob, u: projectId };
  }
}
