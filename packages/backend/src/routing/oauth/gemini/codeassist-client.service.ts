/**
 * CodeAssist client — talks to `cloudcode-pa.googleapis.com/v1internal:*`.
 *
 * Gemini OAuth tokens for personal Google accounts (the `gemini-cli` flow)
 * cannot hit `generativelanguage.googleapis.com` directly: that API needs
 * either an API key or a billed GCP project for quota attribution. The
 * CodeAssist endpoint is what `gemini-cli` itself uses — Google's own
 * "free tier with personal account" path — and routes by an opaque
 * `cloudaicompanionProject` id assigned to the user during onboarding.
 *
 * Two responsibilities:
 *
 *   1. **Onboarding** — first time we see an OAuth token, call
 *      `:loadCodeAssist` to discover the user's tier + assigned project,
 *      then `:onboardUser` if they don't have one yet. The resulting
 *      project id is persisted in the OAuth token blob's `u` field.
 *   2. **Envelope wrap/unwrap** — every chat request must be wrapped as
 *      `{ model, project, request: <standard-Gemini-payload> }`; responses
 *      come back as `{ response: <standard-Gemini-payload>, ... }`.
 *      Streaming chunks have the same wrapper shape.
 */
import { Injectable, Logger } from '@nestjs/common';
import { scrubSecrets } from '../../../common/utils/secret-scrub';

const CODE_ASSIST_BASE = 'https://cloudcode-pa.googleapis.com';
const CODE_ASSIST_VERSION = 'v1internal';
const CODE_ASSIST_OPERATION_POLL_MS = 5_000;
const CODE_ASSIST_OPERATION_MAX_POLLS = 12;

const CLIENT_METADATA = {
  ideType: 'IDE_UNSPECIFIED',
  platform: 'PLATFORM_UNSPECIFIED',
  pluginType: 'GEMINI',
  pluginVersion: '0.1.0',
} as const;

export interface OnboardResult {
  /** The cloudaicompanionProject id to send on every subsequent request. */
  projectId: string;
  /** The tier id ('free-tier' or 'standard-tier'). */
  tierId: string;
}

interface LoadCodeAssistResponse {
  currentTier?: { id?: string };
  cloudaicompanionProject?: string;
  allowedTiers?: { id: string; isDefault?: boolean }[];
}

interface LongRunningOperation {
  done?: boolean;
  name?: string;
  response?: { cloudaicompanionProject?: { id?: string } };
}

@Injectable()
export class CodeAssistClientService {
  private readonly logger = new Logger(CodeAssistClientService.name);

  /**
   * One-time-per-user setup. Returns the project id that must be sent on
   * every chat request thereafter. Idempotent — safe to call repeatedly.
   */
  async onboard(accessToken: string): Promise<OnboardResult> {
    const loaded = await this.callJson<LoadCodeAssistResponse>(':loadCodeAssist', accessToken, {
      metadata: CLIENT_METADATA,
    });
    const existingProject = loaded.cloudaicompanionProject;
    const currentTierId = loaded.currentTier?.id;
    if (existingProject && currentTierId) {
      return { projectId: existingProject, tierId: currentTierId };
    }
    // No project yet — pick the default-allowed tier and onboard. For
    // personal accounts this is `free-tier`.
    const tier = loaded.allowedTiers?.find((t) => t.isDefault) ?? loaded.allowedTiers?.[0];
    if (!tier) {
      throw new Error('CodeAssist returned no allowed tiers — onboarding cannot proceed.');
    }
    const lro = await this.callJson<LongRunningOperation>(':onboardUser', accessToken, {
      tierId: tier.id,
      metadata: CLIENT_METADATA,
    });
    const completed = await this.waitForOperation(lro, accessToken);
    const projectId = completed.response?.cloudaicompanionProject?.id;
    if (!projectId) {
      throw new Error('CodeAssist onboardUser returned no project id.');
    }
    return { projectId, tierId: tier.id };
  }

  private async waitForOperation(
    lro: LongRunningOperation,
    accessToken: string,
  ): Promise<LongRunningOperation> {
    let current = lro;
    for (let poll = 0; poll < CODE_ASSIST_OPERATION_MAX_POLLS && current.done !== true; poll++) {
      if (!current.name) {
        throw new Error('CodeAssist onboardUser operation returned no operation name.');
      }
      await new Promise((resolve) => setTimeout(resolve, CODE_ASSIST_OPERATION_POLL_MS));
      current = await this.callOperation(current.name, accessToken);
    }
    if (current.done !== true) {
      throw new Error('CodeAssist onboardUser operation did not complete.');
    }
    return current;
  }

  private async callJson<T>(
    method: ':loadCodeAssist' | ':onboardUser',
    accessToken: string,
    body: Record<string, unknown>,
  ): Promise<T> {
    const url = `${CODE_ASSIST_BASE}/${CODE_ASSIST_VERSION}${method}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const text = await response.text();
      this.logger.error(`CodeAssist ${method} failed (${response.status}): ${scrubSecrets(text)}`);
      throw new Error(`CodeAssist ${method} failed (${response.status})`);
    }
    return (await response.json()) as T;
  }

  private async callOperation(name: string, accessToken: string): Promise<LongRunningOperation> {
    const url = `${CODE_ASSIST_BASE}/${CODE_ASSIST_VERSION}/${name}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) {
      const text = await response.text();
      this.logger.error(
        `CodeAssist operation ${name} failed (${response.status}): ${scrubSecrets(text)}`,
      );
      throw new Error(`CodeAssist operation ${name} failed (${response.status})`);
    }
    return (await response.json()) as LongRunningOperation;
  }
}
