import { PROVIDERS, type ProviderDef } from './providers.js';
import { getSubscriptionProviderConfig } from '../../../subscription-capabilities/index.mjs';

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
  const prefix = getSubscriptionProviderConfig(provider.id)?.subscriptionTokenPrefix;
  if (prefix && !trimmed.startsWith(prefix)) {
    return {
      valid: false,
      error: `${provider.name} subscription tokens start with "${prefix}"`,
    };
  }
  return { valid: true };
}

export function getModelLabel(providerId: string, modelValue: string): string {
  const prov = getProvider(providerId);
  if (!prov) return modelValue;
  // Exact match
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
  // Vendor-prefixed name (e.g. "anthropic/claude-opus-4-6"): strip prefix and search all providers
  const slashIdx = modelValue.indexOf('/');
  if (slashIdx !== -1) {
    const bare = modelValue.substring(slashIdx + 1);
    for (const p of PROVIDERS) {
      const found = p.models.find((m) => m.value === bare);
      if (found) return found.label;
    }
    // Normalize dots to dashes (OpenRouter uses "4.6", PROVIDERS uses "4-6")
    const normalized = bare.replace(/\./g, '-');
    if (normalized !== bare) {
      for (const p of PROVIDERS) {
        const found = p.models.find((m) => m.value === normalized);
        if (found) return found.label;
      }
    }
    return bare;
  }
  return modelValue;
}
