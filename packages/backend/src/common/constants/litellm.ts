/** LiteLLM gateway used by the built-in `manifest` provider. */

export const MANIFEST_PROVIDER_ID = 'manifest';

const DEFAULT_LITELLM_BASE_URL = 'https://litellm.manifest.build';
const DEFAULT_MAX_BUDGET_USD = 10;

export function getLitellmBaseUrl(): string {
  const raw = process.env['LITELLM_BASE_URL']?.trim() || DEFAULT_LITELLM_BASE_URL;
  return raw.replace(/\/+$/, '');
}

export function getLitellmMasterKey(): string | null {
  const key = process.env['LITELLM_MASTER_KEY']?.trim();
  return key && key.length > 0 ? key : null;
}

export function getLitellmMaxBudgetUsd(): number {
  const raw = process.env['LITELLM_MANIFEST_MAX_BUDGET']?.trim();
  if (!raw) return DEFAULT_MAX_BUDGET_USD;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_MAX_BUDGET_USD;
}

/** Comma-separated emails. Empty list means auto-provision for any user when master key is set. */
export function getLitellmAutoAllowlist(): string[] {
  const raw = process.env['LITELLM_AUTO_PROVISION_ALLOWLIST']?.trim() ?? '';
  if (!raw) return [];
  return raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isLitellmAutoEligible(email: string | null | undefined): boolean {
  if (!getLitellmMasterKey()) return false;
  const allowlist = getLitellmAutoAllowlist();
  if (allowlist.length === 0) return true;
  if (!email) return false;
  return allowlist.includes(email.trim().toLowerCase());
}

/** Models endpoint for discovery (OpenAI-compatible). */
export function getLitellmModelsUrl(): string {
  return `${getLitellmBaseUrl()}/v1/models`;
}

export function getLitellmKeyGenerateUrl(): string {
  return `${getLitellmBaseUrl()}/key/generate`;
}
