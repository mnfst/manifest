export const ZAI_CODING_PLAN_BASE_URLS = {
  global: 'https://api.z.ai/api/coding/paas/v4',
  cn: 'https://open.bigmodel.cn/api/coding/paas/v4',
} as const;

export type ZaiCodingPlanRegion = keyof typeof ZAI_CODING_PLAN_BASE_URLS;

export const DEFAULT_ZAI_CODING_PLAN_REGION: ZaiCodingPlanRegion = 'global';

export function isZaiCodingPlanRegion(
  value: string | undefined | null,
): value is ZaiCodingPlanRegion {
  return value === 'global' || value === 'cn';
}

export function isZaiProviderId(value: string | undefined | null): boolean {
  const lower = value?.toLowerCase();
  return lower === 'zai' || lower === 'z.ai';
}

export function getZaiCodingPlanBaseUrl(
  region: ZaiCodingPlanRegion = DEFAULT_ZAI_CODING_PLAN_REGION,
): string {
  return ZAI_CODING_PLAN_BASE_URLS[region];
}

export function normalizeZaiCodingPlanBaseUrl(baseUrl: string): string | null {
  const normalized = baseUrl.replace(/\/+$/, '');
  const allowedBaseUrls: readonly string[] = Object.values(ZAI_CODING_PLAN_BASE_URLS);
  return allowedBaseUrls.includes(normalized) ? normalized : null;
}
