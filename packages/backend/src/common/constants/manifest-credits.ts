/** Manifest Credits gateway used by the built-in `manifest` provider. */

export const MANIFEST_PROVIDER_ID = 'manifest';

const DEFAULT_MANIFEST_CREDITS_BASE_URL = 'https://credits.manifest.build';
const DEFAULT_MAX_BUDGET_USD = 10;

export function getManifestCreditsBaseUrl(): string {
  const raw = process.env['MANIFEST_CREDITS_BASE_URL']?.trim() || DEFAULT_MANIFEST_CREDITS_BASE_URL;
  return raw.replace(/\/+$/, '');
}

export function getManifestCreditsMasterKey(): string | null {
  const key = process.env['MANIFEST_CREDITS_MASTER_KEY']?.trim();
  return key && key.length > 0 ? key : null;
}

export function getManifestCreditsMaxBudgetUsd(): number {
  const raw = process.env['MANIFEST_CREDITS_MAX_BUDGET']?.trim();
  if (!raw) return DEFAULT_MAX_BUDGET_USD;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_MAX_BUDGET_USD;
}

/** Comma-separated emails. Empty list means auto-provision for any user when master key is set. */
export function getManifestCreditsAutoAllowlist(): string[] {
  const raw = process.env['MANIFEST_CREDITS_AUTO_PROVISION_ALLOWLIST']?.trim() ?? '';
  if (!raw) return [];
  return raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isManifestCreditsAutoEligible(email: string | null | undefined): boolean {
  if (!getManifestCreditsMasterKey()) return false;
  const allowlist = getManifestCreditsAutoAllowlist();
  if (allowlist.length === 0) return true;
  if (!email) return false;
  return allowlist.includes(email.trim().toLowerCase());
}

/** Models endpoint for discovery (OpenAI-compatible). */
export function getManifestCreditsModelsUrl(): string {
  return `${getManifestCreditsBaseUrl()}/v1/models`;
}

export function getManifestCreditsKeyGenerateUrl(): string {
  return `${getManifestCreditsBaseUrl()}/key/generate`;
}
