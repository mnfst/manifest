import { t } from '../i18n/index.js';

export function suggestNextProviderKeyLabel(existing: string[]): string {
  const lower = new Set(existing.map((label) => label.toLowerCase()));
  for (let n = existing.length + 1; n < 100; n++) {
    const candidate = t('services.keyLabel', { number: n });
    if (!lower.has(candidate.toLowerCase())) return candidate;
  }
  return t('services.keyLabel', { number: existing.length + 1 });
}
