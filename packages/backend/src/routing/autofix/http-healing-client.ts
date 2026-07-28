import { Logger } from '@nestjs/common';
import {
  INSTANCE_CREDENTIAL_SCHEMA_VERSION,
  InstanceCredentialService,
} from './instance-credential.service';
import {
  HealContractError,
  type HealingClient,
  type HealingRequestContext,
} from './healing-client';
import type {
  ConfirmResponse,
  HealOutcome,
  HealRequest,
  HealResponse,
  RegisterInstanceRequest,
  RegisterInstanceResponse,
} from './phoenix.types';

/**
 * HTTP client for Phoenix. Static API keys retain the cloud path unchanged.
 * Self-hosted clients without a static key lazily register an encrypted
 * instance credential, refresh it once on 401, and attach bounded identity
 * headers to every protected call.
 */
export class HttpHealingClient implements HealingClient {
  private readonly logger = new Logger(HttpHealingClient.name);
  private readonly baseUrl: string;

  constructor(
    baseUrl: string,
    private readonly timeoutMs: number,
    private readonly apiKey?: string,
    private readonly instanceCredentials?: InstanceCredentialService,
    private readonly manifestVersion?: string,
  ) {
    this.baseUrl = baseUrl.trim().replace(/\/+$/, '');
  }

  async heal(input: HealRequest, context?: HealingRequestContext): Promise<HealResponse> {
    const res = await this.authenticatedFetch(
      '/api/heal',
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
      context,
    );
    if (!res.ok) {
      const message = `Phoenix /api/heal responded ${res.status}`;
      if (res.status >= 400 && res.status < 500) {
        throw new HealContractError(res.status, message);
      }
      throw new Error(message);
    }
    return (await res.json()) as HealResponse;
  }

  async observe(observations: HealRequest[], context?: HealingRequestContext): Promise<void> {
    if (observations.length === 0) return;
    try {
      const res = await this.authenticatedFetch(
        '/api/heal/observe',
        {
          method: 'POST',
          body: JSON.stringify({ observations }),
        },
        context,
      );
      await res.body?.cancel();
      if (!res.ok) {
        this.logger.warn(`Phoenix /api/heal/observe responded ${res.status}`);
      }
    } catch (err) {
      this.logger.warn(`Phoenix /api/heal/observe failed: ${(err as Error).message}`);
    }
  }

  async reportOutcome(
    healAttemptId: string,
    outcome: HealOutcome,
    context?: HealingRequestContext,
  ): Promise<ConfirmResponse | null> {
    try {
      const path = `/api/heal-attempts/${encodeURIComponent(healAttemptId)}`;
      const res = await this.authenticatedFetch(
        path,
        {
          method: 'PATCH',
          body: JSON.stringify(outcome),
        },
        context,
      );
      if (!res.ok) {
        this.logger.warn(`Phoenix heal-attempt ${healAttemptId} responded ${res.status}`);
        return null;
      }
      return (await res.json()) as ConfirmResponse;
    } catch (err) {
      this.logger.warn(`Phoenix heal-attempt ${healAttemptId} failed: ${(err as Error).message}`);
      return null;
    }
  }

  private async authenticatedFetch(
    path: string,
    init: Omit<RequestInit, 'headers' | 'signal'>,
    context?: HealingRequestContext,
  ): Promise<Response> {
    if (this.apiKey) {
      return this.request(path, init, {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
      });
    }
    if (!this.instanceCredentials) {
      return this.request(path, init, { 'content-type': 'application/json' });
    }
    if (!context) {
      throw new Error('Autofix harness is required for instance-authenticated requests');
    }

    let credential = await this.instanceCredentials.getOrRegister(() => this.register());
    let res = await this.request(path, init, this.instanceHeaders(credential, context));
    if (res.status !== 401) return res;

    await res.body?.cancel();
    await this.instanceCredentials.clear(credential.instanceId);
    credential = await this.instanceCredentials.getOrRegister(() => this.register());
    return this.request(path, init, this.instanceHeaders(credential, context));
  }

  private request(
    path: string,
    init: Omit<RequestInit, 'headers' | 'signal'>,
    headers: Record<string, string>,
  ): Promise<Response> {
    return fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers,
      signal: AbortSignal.timeout(this.timeoutMs),
    });
  }

  private instanceHeaders(
    credential: { instanceId: string; secret: string },
    context: HealingRequestContext,
  ): Record<string, string> {
    return {
      'content-type': 'application/json',
      Authorization: `Bearer ${credential.secret}`,
      'X-Manifest-Instance': credential.instanceId,
      'X-Manifest-Version': this.manifestVersion ?? 'unknown',
      'X-Manifest-Harness': context.harness,
    };
  }

  private async register(): Promise<RegisterInstanceResponse> {
    const body: RegisterInstanceRequest = {
      version: this.manifestVersion ?? 'unknown',
      schema_version: INSTANCE_CREDENTIAL_SCHEMA_VERSION,
    };
    const res = await this.request(
      '/api/instances/register',
      { method: 'POST', body: JSON.stringify(body) },
      { 'content-type': 'application/json' },
    );
    if (res.status !== 201) {
      const message = `Phoenix /api/instances/register responded ${res.status}`;
      if (res.status >= 400 && res.status < 500) {
        throw new HealContractError(res.status, message);
      }
      throw new Error(message);
    }
    const issued = (await res.json()) as Partial<RegisterInstanceResponse>;
    if (
      typeof issued.instance_id !== 'string' ||
      issued.instance_id.length === 0 ||
      typeof issued.secret !== 'string' ||
      issued.secret.length === 0
    ) {
      throw new HealContractError(201, 'Phoenix registration response was malformed');
    }
    return issued as RegisterInstanceResponse;
  }
}
