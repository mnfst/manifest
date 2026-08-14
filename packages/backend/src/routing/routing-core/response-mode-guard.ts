import { BadRequestException } from '@nestjs/common';
import type { ModelRoute, ResponseMode } from 'manifest-shared';
import { modelSupportsStreaming } from '../../model-discovery/model-capabilities';

export interface EffectiveRoutes {
  primaryRoute: ModelRoute | null;
  fallbackRoutes: ModelRoute[] | null;
}

export function assertStreamableResponseMode(
  responseMode: ResponseMode | null | undefined,
  scopeLabel: string,
  primaryRoute: ModelRoute | null | undefined,
  fallbackRoutes: ModelRoute[] | null | undefined,
): void {
  if (responseMode !== 'stream') return;
  const effective = effectiveRoutesForResponseMode(responseMode, primaryRoute, fallbackRoutes);
  if (effective.primaryRoute) return;

  throw new BadRequestException(
    `Cannot enable streaming for ${scopeLabel}: add at least one stream-capable model.`,
  );
}

export function effectiveRoutesForResponseMode(
  responseMode: ResponseMode | null | undefined,
  primaryRoute: ModelRoute | null | undefined,
  fallbackRoutes: ModelRoute[] | null | undefined,
): EffectiveRoutes {
  if (responseMode !== 'stream') {
    return {
      primaryRoute: primaryRoute ?? null,
      fallbackRoutes: fallbackRoutes ?? null,
    };
  }

  const streamableRoutes = [primaryRoute, ...(fallbackRoutes ?? [])].filter(
    (route): route is ModelRoute => !!route && modelSupportsStreaming(route.provider, route.model),
  );
  return {
    primaryRoute: streamableRoutes[0] ?? null,
    fallbackRoutes: streamableRoutes.length > 1 ? streamableRoutes.slice(1) : null,
  };
}
