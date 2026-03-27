import { Injectable, Logger } from '@nestjs/common';

const GITHUB_CLIENT_ID = 'Iv1.b507a08c87ecfe98';
const DEVICE_CODE_URL = 'https://github.com/login/device/code';
const ACCESS_TOKEN_URL = 'https://github.com/login/oauth/access_token';

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

export type PollStatus = 'pending' | 'complete' | 'expired' | 'denied' | 'slow_down';

@Injectable()
export class CopilotDeviceAuthService {
  private readonly logger = new Logger(CopilotDeviceAuthService.name);

  async requestDeviceCode(): Promise<DeviceCodeResponse> {
    const res = await fetch(DEVICE_CODE_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: GITHUB_CLIENT_ID,
        scope: 'read:user',
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      throw new Error(`GitHub device code request failed: ${res.status}`);
    }

    const data = (await res.json()) as DeviceCodeResponse;
    if (!data.device_code || !data.user_code) {
      throw new Error('Invalid device code response from GitHub');
    }
    return data;
  }

  async pollForToken(deviceCode: string): Promise<{ status: PollStatus; token?: string }> {
    const res = await fetch(ACCESS_TOKEN_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: GITHUB_CLIENT_ID,
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      throw new Error(`GitHub token poll failed: ${res.status}`);
    }

    return this.parsePollResponse((await res.json()) as { access_token?: string; error?: string });
  }

  private parsePollResponse(data: { access_token?: string; error?: string }): {
    status: PollStatus;
    token?: string;
  } {
    if (data.access_token) return { status: 'complete', token: data.access_token };
    if (data.error === 'authorization_pending') return { status: 'pending' };
    if (data.error === 'slow_down') return { status: 'slow_down' };
    if (data.error === 'expired_token') return { status: 'expired' };
    if (data.error === 'access_denied') return { status: 'denied' };

    this.logger.warn(`Unexpected GitHub poll response: ${JSON.stringify(data)}`);
    return { status: 'pending' };
  }
}
