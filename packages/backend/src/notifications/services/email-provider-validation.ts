const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  normalized: { provider: string; apiKey: string; domain: string };
}

export function validateProviderConfig(
  provider: string,
  apiKey: string,
  domain: string,
): ValidationResult {
  const errors: string[] = [];
  const trimmedKey = apiKey.trim();
  const trimmedDomain = domain.trim().toLowerCase();

  if (provider === 'resend') {
    if (!trimmedKey.startsWith('re_')) {
      errors.push('Resend API key must start with re_');
    }
  }

  if (trimmedKey.length < 8) {
    errors.push('API key must be at least 8 characters');
  }

  if (!trimmedDomain) {
    errors.push('Domain is required');
  } else if (!DOMAIN_RE.test(trimmedDomain)) {
    errors.push('Invalid domain format');
  }

  return {
    valid: errors.length === 0,
    errors,
    normalized: { provider, apiKey: trimmedKey, domain: trimmedDomain },
  };
}
