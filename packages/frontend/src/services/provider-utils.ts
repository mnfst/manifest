import { resolveProviderMetadataIdentity } from 'manifest-shared';
import { PROVIDERS, type ProviderDef } from './providers.js';

export function getProvider(id: string): ProviderDef | undefined {
  return PROVIDERS.find((p) => p.id === id);
}

export interface CredentialValidationErrorParams {
  apiKeyRequired: Record<string, never>;
  apiKeyPrefix: { provider: string; prefix: string };
  apiKeyTooShort: { minLength: number };
  subscriptionTokenRequired: Record<string, never>;
  subscriptionTokenPrefix: { provider: string; prefix: string };
  apiKeyInSubscriptionMode: Record<string, never>;
  subscriptionTokenTooShort: { minLength: number };
}

export type CredentialValidationErrorCode = keyof CredentialValidationErrorParams;

export type CredentialValidationError = {
  [Code in CredentialValidationErrorCode]: {
    code: Code;
    params: Readonly<CredentialValidationErrorParams[Code]>;
  };
}[CredentialValidationErrorCode];

export type CredentialValidationResult =
  | { valid: true }
  | { valid: false; error: CredentialValidationError };

export function validateApiKey(provider: ProviderDef, key: string): CredentialValidationResult {
  if (provider.noKeyRequired) return { valid: true };

  const trimmed = key.replace(/\s/g, '');
  if (!trimmed) {
    return { valid: false, error: { code: 'apiKeyRequired', params: {} } };
  }

  if (provider.keyPrefix && !trimmed.startsWith(provider.keyPrefix)) {
    return {
      valid: false,
      error: {
        code: 'apiKeyPrefix',
        params: { provider: provider.name, prefix: provider.keyPrefix },
      },
    };
  }

  if (provider.minKeyLength && trimmed.length < provider.minKeyLength) {
    return {
      valid: false,
      error: {
        code: 'apiKeyTooShort',
        params: { minLength: provider.minKeyLength },
      },
    };
  }

  return { valid: true };
}

const SUBSCRIPTION_PREFIXES: Record<string, string> = {
  anthropic: 'sk-ant-oat',
  minimax: 'sk-cp-',
  qwen: 'sk-sp-',
  xiaomi: 'tp-',
};

const SUBSCRIPTION_MIN_LENGTHS: Record<string, number> = {
  qwen: 30,
  xiaomi: 10,
};

/** Prefixes that identify API keys — reject these in subscription mode. */
const API_KEY_PREFIXES: Record<string, string> = {
  openai: 'sk-',
};

export function validateSubscriptionKey(
  provider: ProviderDef,
  key: string,
): CredentialValidationResult {
  const trimmed = key.replace(/\s/g, '');
  if (!trimmed) {
    return { valid: false, error: { code: 'subscriptionTokenRequired', params: {} } };
  }
  const prefix = SUBSCRIPTION_PREFIXES[provider.id];
  if (prefix && !trimmed.startsWith(prefix)) {
    return {
      valid: false,
      error: {
        code: 'subscriptionTokenPrefix',
        params: { provider: provider.name, prefix },
      },
    };
  }
  const apiPrefix = API_KEY_PREFIXES[provider.id];
  if (apiPrefix && trimmed.startsWith(apiPrefix)) {
    return {
      valid: false,
      error: { code: 'apiKeyInSubscriptionMode', params: {} },
    };
  }
  // Providers that expose a paste-token alternative alongside an OAuth flow
  // (currently MiniMax) bring their full API-key length envelope with them —
  // a real `sk-cp-` token is ~100 chars, not 11. Enforce that here so the
  // backend doesn't persist obviously truncated values. Other subscription
  // providers (Anthropic setup-token, OpenAI ChatGPT JWT) stay on the generic
  // 10-char floor since their tokens can be legitimately shorter.
  const minLength =
    SUBSCRIPTION_MIN_LENGTHS[provider.id] ??
    (provider.subscriptionTokenAlternative && provider.minKeyLength > 10
      ? provider.minKeyLength
      : 10);
  if (trimmed.length < minLength) {
    return {
      valid: false,
      error: {
        code: 'subscriptionTokenTooShort',
        params: { minLength },
      },
    };
  }
  return { valid: true };
}

/** Format a model slug into a human-readable label. */
function formatModelSlug(slug: string): string {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function dotPrefixedModel(modelValue: string): { providerId: string; bare: string } | null {
  const resolved = resolveProviderMetadataIdentity('bedrock', modelValue);
  if (!resolved.provider || resolved.provider === 'bedrock' || resolved.model === modelValue) {
    return null;
  }
  return { providerId: resolved.provider, bare: resolved.model };
}

export function getModelLabel(providerId: string, modelValue: string): string {
  if (!modelValue) return '';
  const prov = getProvider(providerId);
  if (!prov) return modelValue;
  // Exact match in provider's static models (if any remain)
  const exact = prov.models.find((m) => m.value === modelValue);
  if (exact) return exact.label;
  // Strip date suffix (e.g. "-20250929") and try again
  const stripped = modelValue.replace(/-\d{8}$/, '');
  if (stripped !== modelValue) {
    const m = prov.models.find((m) => m.value === stripped);
    if (m) return m.label;
  }
  // Prefix match: modelValue starts with a known value
  const prefix = prov.models.find((m) => modelValue.startsWith(m.value + '-'));
  if (prefix) return prefix.label;
  // Vendor-prefixed name (e.g. "anthropic/claude-opus-4-6"): strip prefix
  const slashIdx = modelValue.indexOf('/');
  if (slashIdx !== -1) {
    const bare = modelValue.substring(slashIdx + 1);
    for (const p of PROVIDERS) {
      const found = p.models.find((m) => m.value === bare);
      if (found) return found.label;
    }
    return formatModelSlug(bare);
  }
  if (prov.id === 'bedrock') {
    // Bedrock/Mantle model IDs are routable AWS IDs like
    // "us.anthropic.claude-sonnet-4.6"; display the underlying model label.
    const dotPrefixed = dotPrefixedModel(modelValue);
    if (dotPrefixed) {
      const dotProvider = getProvider(dotPrefixed.providerId);
      const found = dotProvider?.models.find((m) => m.value === dotPrefixed.bare);
      if (found) return found.label;
      return formatModelSlug(dotPrefixed.bare);
    }
  }
  // Fallback: format the model slug as a readable label
  return formatModelSlug(modelValue);
}
