import { PROVIDERS, type ProviderDef } from './providers.js';

const CLOUDFLARE_ACCOUNT_ID_REGEX = /^[a-f0-9]{32}$/i;

function validateCloudflareCredentials(key: string): { valid: boolean; error?: string } {
  const separatorIndex = key.indexOf(':');
  if (separatorIndex <= 0) {
    return {
      valid: false,
      error: 'Use ACCOUNT_ID:API_TOKEN for Cloudflare Workers AI',
    };
  }

  const accountId = key.slice(0, separatorIndex);
  const apiToken = key.slice(separatorIndex + 1);
  if (!CLOUDFLARE_ACCOUNT_ID_REGEX.test(accountId)) {
    return {
      valid: false,
      error: 'Cloudflare account IDs are 32 hexadecimal characters',
    };
  }
  if (apiToken.length < 20) {
    return {
      valid: false,
      error: 'Cloudflare API token is too short (minimum 20 characters)',
    };
  }

  return { valid: true };
}

const CUSTOM_API_KEY_VALIDATORS: Record<
  string,
  (key: string) => { valid: boolean; error?: string }
> = {
  cloudflare: validateCloudflareCredentials,
};

export function getProvider(id: string): ProviderDef | undefined {
  return PROVIDERS.find((p) => p.id === id);
}

export function validateApiKey(
  provider: ProviderDef,
  key: string,
): { valid: boolean; error?: string } {
  if (provider.noKeyRequired) return { valid: true };

  const trimmed = key.replace(/\s/g, '');
  if (!trimmed) return { valid: false, error: 'API key is required' };

  const customValidator = CUSTOM_API_KEY_VALIDATORS[provider.id];
  if (customValidator) {
    return customValidator(trimmed);
  }

  if (provider.keyPrefix && !trimmed.startsWith(provider.keyPrefix)) {
    return {
      valid: false,
      error: `${provider.name} keys start with "${provider.keyPrefix}"`,
    };
  }

  if (provider.minKeyLength && trimmed.length < provider.minKeyLength) {
    return {
      valid: false,
      error: `Key is too short (minimum ${provider.minKeyLength} characters)`,
    };
  }

  return { valid: true };
}

const SUBSCRIPTION_PREFIXES: Record<string, string> = {
  anthropic: 'sk-ant-oat',
};

/** Prefixes that identify API keys — reject these in subscription mode. */
const API_KEY_PREFIXES: Record<string, string> = {
  openai: 'sk-',
};

export function validateSubscriptionKey(
  provider: ProviderDef,
  key: string,
): { valid: boolean; error?: string } {
  const trimmed = key.replace(/\s/g, '');
  if (!trimmed) return { valid: false, error: 'Token is required' };
  if (trimmed.length < 10) {
    return {
      valid: false,
      error: 'Token is too short (minimum 10 characters)',
    };
  }
  const prefix = SUBSCRIPTION_PREFIXES[provider.id];
  if (prefix && !trimmed.startsWith(prefix)) {
    return {
      valid: false,
      error: `${provider.name} subscription tokens start with "${prefix}"`,
    };
  }
  const apiPrefix = API_KEY_PREFIXES[provider.id];
  if (apiPrefix && trimmed.startsWith(apiPrefix)) {
    return {
      valid: false,
      error: 'This looks like an API key. Use the API Key tab instead.',
    };
  }
  return { valid: true };
}

/** Format a model slug into a human-readable label. */
function formatModelSlug(slug: string): string {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getModelLabel(providerId: string, modelValue: string): string {
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
  // Fallback: format the model slug as a readable label
  return formatModelSlug(modelValue);
}
