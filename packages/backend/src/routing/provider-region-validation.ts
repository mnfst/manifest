import { BadRequestException } from '@nestjs/common';
import type { AuthType } from 'manifest-shared';
import { isQwenRegion } from './qwen-region';
import { getSubscriptionEndpointRegionConfig } from './subscription-region';

export function assertProviderRegionSupported(
  provider: string,
  authType: AuthType | undefined,
  region: string | undefined,
): void {
  if (region === undefined) return;

  const lowerProvider = provider.toLowerCase();
  const isQwenProvider = lowerProvider === 'qwen' || lowerProvider === 'alibaba';
  const subscriptionRegionConfig = getSubscriptionEndpointRegionConfig(lowerProvider, authType);

  if (isQwenProvider) {
    if (!isQwenRegion(region)) {
      throw new BadRequestException('region must be one of: auto, singapore, us, beijing');
    }
    return;
  }

  if (subscriptionRegionConfig) {
    if (!subscriptionRegionConfig.isRegion(region)) {
      throw new BadRequestException(subscriptionRegionConfig.validationMessage);
    }
    return;
  }

  throw new BadRequestException(
    'region is only supported for Alibaba/Qwen providers, MiniMax subscriptions, Xiaomi MiMo Token Plan, and Z.ai subscriptions',
  );
}
