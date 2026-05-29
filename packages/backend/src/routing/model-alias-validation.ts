import { BadRequestException } from '@nestjs/common';
import {
  classifyModelAlias,
  headerTierNameToModelAlias,
  specificityCategoryToAlias,
  type ModelAliasClassification,
} from 'manifest-shared';
import { formatManifestError } from '../common/errors/error-codes';
import type { ResolveResponse } from './dto/resolve-response';
import type { HeaderTierService } from './header-tiers/header-tier.service';
import type { RoutingAliasService } from './routing-alias.service';

export async function parseModelAliasFromBody(
  body: Record<string, unknown>,
  agentId: string,
  deps: {
    headerTierService: Pick<HeaderTierService, 'findByModelAlias'>;
    routingAliasService: Pick<RoutingAliasService, 'listConfiguredAliases'>;
  },
): Promise<ModelAliasClassification> {
  const model = body.model;
  if (typeof model !== 'string' || model.length === 0) {
    const aliases = (await deps.routingAliasService.listConfiguredAliases(agentId)).join(', ');
    throw new BadRequestException(
      formatManifestError('M410', {
        model: model === undefined || model === null ? '' : String(model),
        aliases,
      }),
    );
  }

  const allowed = await deps.routingAliasService.listConfiguredAliases(agentId);
  const allowedSet = new Set(allowed);

  const classified = classifyModelAlias(model);
  if (classified?.kind === 'auto') return classified;
  if (classified?.kind === 'tier' && allowedSet.has(classified.tier)) return classified;
  if (
    classified?.kind === 'specificity' &&
    allowedSet.has(specificityCategoryToAlias(classified.category))
  ) {
    return classified;
  }

  const customTier = await deps.headerTierService.findByModelAlias(agentId, model);
  if (customTier) {
    const label = headerTierNameToModelAlias(customTier.name);
    if (allowedSet.has(label)) return { kind: 'header_tier', id: customTier.id };
  }

  throw new BadRequestException(
    formatManifestError('M410', { model, aliases: allowed.join(', ') }),
  );
}

export function modelAliasLabel(
  alias: Exclude<ModelAliasClassification, { kind: 'auto' }>,
  headerTierName?: string,
): string {
  if (alias.kind === 'header_tier') {
    return headerTierName ? headerTierNameToModelAlias(headerTierName) : alias.id;
  }
  if (alias.kind === 'tier') return alias.tier;
  return alias.category.replace(/_/g, '-');
}

export function assertAliasRouteConfigured(
  alias: string,
  resolved: ResolveResponse,
  dashboardUrl: string,
): void {
  if (!resolved.route) {
    throw new BadRequestException(formatManifestError('M411', { alias, dashboardUrl }));
  }
}
