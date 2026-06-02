import {
  getZaiCodingPlanBaseUrl,
  isZaiCodingPlanRegion,
  isZaiProviderId,
  normalizeZaiCodingPlanBaseUrl,
} from './zai-region';

describe('zai-region', () => {
  it('recognizes the supported Coding Plan regions', () => {
    expect(isZaiCodingPlanRegion('global')).toBe(true);
    expect(isZaiCodingPlanRegion('cn')).toBe(true);
    expect(isZaiCodingPlanRegion('eu')).toBe(false);
    expect(isZaiCodingPlanRegion(undefined)).toBe(false);
  });

  it('recognizes canonical and dotted provider ids', () => {
    expect(isZaiProviderId('zai')).toBe(true);
    expect(isZaiProviderId('z.ai')).toBe(true);
    expect(isZaiProviderId('Z.AI')).toBe(true);
    expect(isZaiProviderId('openai')).toBe(false);
  });

  it('maps regions to Coding Plan base URLs', () => {
    expect(getZaiCodingPlanBaseUrl()).toBe('https://api.z.ai/api/coding/paas/v4');
    expect(getZaiCodingPlanBaseUrl('global')).toBe('https://api.z.ai/api/coding/paas/v4');
    expect(getZaiCodingPlanBaseUrl('cn')).toBe('https://open.bigmodel.cn/api/coding/paas/v4');
  });

  it('normalizes only supported Coding Plan base URLs', () => {
    expect(normalizeZaiCodingPlanBaseUrl('https://api.z.ai/api/coding/paas/v4/')).toBe(
      'https://api.z.ai/api/coding/paas/v4',
    );
    expect(normalizeZaiCodingPlanBaseUrl('https://open.bigmodel.cn/api/coding/paas/v4')).toBe(
      'https://open.bigmodel.cn/api/coding/paas/v4',
    );
    expect(normalizeZaiCodingPlanBaseUrl('https://example.com/api/coding/paas/v4')).toBeNull();
  });
});
