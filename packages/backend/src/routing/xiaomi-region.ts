import { normalizeProviderBaseUrl } from './provider-base-url';

export const XIAOMI_TOKEN_PLAN_BASE_URLS = {
  cn: 'https://token-plan-cn.xiaomimimo.com',
  sgp: 'https://token-plan-sgp.xiaomimimo.com',
  ams: 'https://token-plan-ams.xiaomimimo.com',
} as const;

export type XiaomiTokenPlanRegion = keyof typeof XIAOMI_TOKEN_PLAN_BASE_URLS;

export const DEFAULT_XIAOMI_TOKEN_PLAN_REGION: XiaomiTokenPlanRegion = 'cn';

export function isXiaomiTokenPlanRegion(
  value: string | undefined | null,
): value is XiaomiTokenPlanRegion {
  return value === 'cn' || value === 'sgp' || value === 'ams';
}

export function isXiaomiProviderId(value: string | undefined | null): boolean {
  const lower = value?.toLowerCase();
  return lower === 'xiaomi' || lower === 'mimo' || lower === 'xiaomi-mimo';
}

export function getXiaomiTokenPlanBaseUrl(
  region: XiaomiTokenPlanRegion = DEFAULT_XIAOMI_TOKEN_PLAN_REGION,
): string {
  return XIAOMI_TOKEN_PLAN_BASE_URLS[region];
}

export function normalizeXiaomiTokenPlanBaseUrl(baseUrl: string): string | null {
  const normalized = normalizeProviderBaseUrl(baseUrl);
  const allowedBaseUrls: readonly string[] = Object.values(XIAOMI_TOKEN_PLAN_BASE_URLS);
  return allowedBaseUrls.includes(normalized) ? normalized : null;
}
