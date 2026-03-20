import { normalizeProviderBaseUrl } from './provider-base-url';

const QWEN_REGION_BASE_URLS = {
  singapore: 'https://dashscope-intl.aliyuncs.com/compatible-mode',
  us: 'https://dashscope-us.aliyuncs.com/compatible-mode',
  beijing: 'https://dashscope.aliyuncs.com/compatible-mode',
} as const;

const QWEN_ALLOWED_BASE_URLS: ReadonlySet<string> = new Set(Object.values(QWEN_REGION_BASE_URLS));
const QWEN_REGION_DETECTION_ORDER = ['singapore', 'us', 'beijing'] as const;
const QWEN_DETECTION_TIMEOUT_MS = 3000;

export type QwenResolvedRegion = keyof typeof QWEN_REGION_BASE_URLS;
export type QwenRegion = 'auto' | QwenResolvedRegion;

function buildModelsUrl(region: QwenResolvedRegion): string {
  return `${QWEN_REGION_BASE_URLS[region]}/v1/models`;
}

export function isQwenResolvedRegion(
  value: string | null | undefined,
): value is QwenResolvedRegion {
  return value === 'singapore' || value === 'us' || value === 'beijing';
}

export function isQwenRegion(value: string | null | undefined): value is QwenRegion {
  return value === 'auto' || isQwenResolvedRegion(value);
}

export function getQwenCompatibleBaseUrl(region?: string | null): string {
  if (isQwenResolvedRegion(region)) return QWEN_REGION_BASE_URLS[region];
  return QWEN_REGION_BASE_URLS.beijing;
}

export function normalizeQwenCompatibleBaseUrl(baseUrl: string): string | null {
  const normalized = normalizeProviderBaseUrl(baseUrl);
  return QWEN_ALLOWED_BASE_URLS.has(normalized) ? normalized : null;
}

export async function detectQwenRegion(
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<QwenResolvedRegion | null> {
  const headers = { Authorization: `Bearer ${apiKey}` };

  for (const region of QWEN_REGION_DETECTION_ORDER) {
    try {
      const response = await fetchImpl(buildModelsUrl(region), {
        headers,
        signal: AbortSignal.timeout(QWEN_DETECTION_TIMEOUT_MS),
      });
      if (response.ok) return region;
    } catch {
      // Try the next official region before giving up.
    }
  }

  return null;
}
