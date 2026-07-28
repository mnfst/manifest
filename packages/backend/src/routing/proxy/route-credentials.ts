/**
 * Shared route-credential resolution and local credential-failure attempts.
 *
 * Primary proxy and mid-chain fallbacks must agree on:
 *  - how a route becomes a usable apiKey (or why it cannot)
 *  - which Manifest code/message that maps to (M100 vs M102)
 *  - how that failure appears as a recorded attempt on the Manifest request
 *
 * Keep new credential failure kinds here — callers should not re-implement
 * selectProviderKey → resolveApiKey or invent parallel error text.
 */
import type { AuthType } from 'manifest-shared';
import {
  ProviderKeyService,
  SYNTHETIC_OLLAMA_PROVIDER_ID,
} from '../routing-core/provider-key.service';
import { formatManifestError, type ManifestErrorCode } from '../../common/errors/error-codes';
import type { ManifestBlockedRequestReason } from '../../common/errors/manifest-error';
import {
  isRefreshableOAuthCredential,
  resolveApiKey,
  type OAuthServiceSet,
} from './oauth-credentials';
import type { ForwardResult } from './provider-client';
import type { ProviderAttemptRef, StartProviderAttempt } from './proxy-types';

/** Why a route could not produce a usable provider apiKey. */
export type CredentialFailureReason = Extract<
  ManifestBlockedRequestReason,
  'no_provider_key' | 'subscription_credentials_unusable'
>;

const CREDENTIAL_FAILURE_CODE: Record<
  CredentialFailureReason,
  Extract<ManifestErrorCode, 'M100' | 'M102'>
> = {
  no_provider_key: 'M100',
  subscription_credentials_unusable: 'M102',
};

/** HTTP status for local credential failures so shouldTriggerFallback still fires. */
export const CREDENTIAL_FAILURE_HTTP_STATUS = 401;

export type ResolvedRouteCredentials =
  | {
      ok: true;
      apiKey: string;
      rawApiKey: string;
      resourceUrl?: string;
      providerRegion?: string | null;
      tenantProviderId: string | null;
      /** Effective key label after unpinned subscription resolution. */
      keyLabel?: string;
    }
  | {
      ok: false;
      reason: CredentialFailureReason;
      tenantProviderId: string | null;
    };

export interface CredentialFailurePresentation {
  code: Extract<ManifestErrorCode, 'M100' | 'M102'>;
  reason: CredentialFailureReason;
  message: string;
  status: typeof CREDENTIAL_FAILURE_HTTP_STATUS;
  errorBody: string;
}

export interface RouteCredentialDeps {
  providerKeyService: Pick<ProviderKeyService, 'selectProviderKey' | 'getProviderApiKey'>;
  oauth: OAuthServiceSet;
}

export function credentialFailureCode(
  reason: CredentialFailureReason,
): Extract<ManifestErrorCode, 'M100' | 'M102'> {
  return CREDENTIAL_FAILURE_CODE[reason];
}

/**
 * User-facing Manifest error for a credential miss.
 * `dashboardUrl` should be a real agent routing URL when available.
 */
export function presentCredentialFailure(
  reason: CredentialFailureReason,
  provider: string,
  dashboardUrl: string,
): CredentialFailurePresentation {
  const code = credentialFailureCode(reason);
  const message = formatManifestError(code, { provider, dashboardUrl });
  return {
    code,
    reason,
    message,
    status: CREDENTIAL_FAILURE_HTTP_STATUS,
    errorBody: JSON.stringify({ error: { message } }),
  };
}

/** Start + complete a local provider attempt for a credential failure. */
export function startCredentialFailureAttempt(
  startProviderAttempt: StartProviderAttempt | undefined,
  start: {
    provider: string;
    model: string;
    authType?: string;
    tenantProviderId?: string | null;
  },
): ProviderAttemptRef | undefined {
  const attempt = startProviderAttempt?.(start);
  if (attempt) attempt.completedAtMs = Date.now();
  return attempt;
}

/**
 * Synthetic primary forward when credentials never reached provider transport.
 * `providerCallStarted: true` so the attempt is persisted (unlike rate-limit cooldowns).
 */
export function buildCredentialFailureForward(opts: {
  provider: string;
  model: string;
  authType?: AuthType;
  tenantProviderId: string | null;
  presentation: CredentialFailurePresentation;
  startProviderAttempt?: StartProviderAttempt;
}): ForwardResult {
  const attempt = startCredentialFailureAttempt(opts.startProviderAttempt, {
    provider: opts.provider,
    model: opts.model,
    authType: opts.authType,
    tenantProviderId: opts.tenantProviderId,
  });
  return {
    response: new Response(opts.presentation.errorBody, {
      status: opts.presentation.status,
      headers: { 'content-type': 'application/json' },
    }),
    providerCallStarted: true,
    attempt,
    isGoogle: false,
    isAnthropic: false,
    isChatGpt: false,
  };
}

/**
 * Mid-chain credential failure entry for `FailedFallback[]`.
 * Shape matches FailedFallback so the fallback service can push it directly.
 */
export function buildCredentialFailureFallback(opts: {
  model: string;
  provider: string;
  fallbackIndex: number;
  authType?: AuthType;
  tenantProviderId: string | null;
  presentation: CredentialFailurePresentation;
  startProviderAttempt?: StartProviderAttempt;
}): {
  model: string;
  provider: string;
  fallbackIndex: number;
  status: number;
  errorBody: string;
  authType?: AuthType;
  tenantProviderId: string | null;
  attempt?: ProviderAttemptRef;
  providerCallStarted: true;
} {
  const attempt = startCredentialFailureAttempt(opts.startProviderAttempt, {
    provider: opts.provider,
    model: opts.model,
    authType: opts.authType,
    tenantProviderId: opts.tenantProviderId,
  });
  return {
    model: opts.model,
    provider: opts.provider,
    fallbackIndex: opts.fallbackIndex,
    status: opts.presentation.status,
    errorBody: opts.presentation.errorBody,
    authType: opts.authType,
    tenantProviderId: opts.tenantProviderId,
    attempt,
    providerCallStarted: true,
  };
}

/**
 * Single key selection + OAuth unwrap for one route hop.
 * Used by primary proxy and mid-chain fallbacks.
 */
export async function resolveRouteCredentials(
  deps: RouteCredentialDeps,
  args: {
    agentId: string;
    tenantId: string;
    provider: string;
    authType?: AuthType;
    providerKeyLabel?: string;
  },
): Promise<ResolvedRouteCredentials> {
  const { providerKeyService, oauth } = deps;
  const { agentId, tenantId, provider, authType } = args;
  let providerKeyLabel = args.providerKeyLabel;

  // Single key selection per hop: apiKey, tenant_provider_id, region, and
  // label all come from this one row so they can never diverge.
  const key = await providerKeyService.selectProviderKey(
    tenantId,
    provider,
    authType,
    providerKeyLabel,
    agentId,
  );
  if (!key || key.apiKey === null) {
    return { ok: false, reason: 'no_provider_key', tenantProviderId: null };
  }

  const apiKey = key.apiKey;
  // NULL for synthetic Ollama — no persisted row to stamp (FK).
  const tenantProviderId = key.id === SYNTHETIC_OLLAMA_PROVIDER_ID ? null : key.id;

  // Unpinned subscription: pin to the selected row so OAuth refresh updates
  // the same connection getProviderApiKey / unwrap used.
  if (!providerKeyLabel && authType === 'subscription') {
    providerKeyLabel = key.label;
  }

  const unwrapped = await resolveApiKey(
    provider,
    apiKey,
    authType,
    agentId,
    tenantId,
    oauth.openaiOauth,
    oauth.minimaxOauth,
    oauth.anthropicOauth,
    oauth.geminiOauth,
    oauth.kiroOauth,
    oauth.xaiOauth,
    providerKeyLabel,
  );

  // resolveApiKey only returns null when a subscription OAuth blob exists
  // but cannot be unwrapped / refreshed.
  if (unwrapped.apiKey === null) {
    return {
      ok: false,
      reason: 'subscription_credentials_unusable',
      tenantProviderId,
    };
  }

  let rawApiKey = apiKey;
  if (authType === 'subscription' && isRefreshableOAuthCredential(apiKey)) {
    // Deliberate re-read: resolveApiKey may have refreshed + persisted a
    // rotated OAuth blob (which also invalidates the key cache).
    rawApiKey =
      (await providerKeyService.getProviderApiKey(
        tenantId,
        provider,
        authType,
        providerKeyLabel,
        agentId,
      )) ?? apiKey;
  }

  return {
    ok: true,
    apiKey: unwrapped.apiKey,
    rawApiKey,
    resourceUrl: unwrapped.resourceUrl,
    providerRegion: key.region,
    tenantProviderId,
    keyLabel: providerKeyLabel,
  };
}
