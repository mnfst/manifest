import { Controller, Get } from '@nestjs/common';
import { TenantCtx, TenantContext } from '../../common/decorators/tenant-context.decorator';
import { ProviderUsageService, ProviderUsageSummary } from '../services/provider-usage.service';
import { filterProvidersForDeployment } from '../../common/utils/provider-availability';

/**
 * Usage half of the provider dashboard split. Config (cheap, from
 * `tenant_providers`) is served by `TenantProvidersController` at
 * `GET /api/v1/providers`; this endpoint serves the expensive per-(provider,
 * auth_type) usage stats so a config read never touches `agent_messages`.
 *
 * The frontend fetches the two independently and merges by (provider,
 * auth_type), so the page paints from config immediately and fills in usage
 * once this resolves.
 */
@Controller('api/v1/providers/usage')
export class ProviderUsageController {
  constructor(private readonly providerUsage: ProviderUsageService) {}

  @Get()
  async getUsage(@TenantCtx() ctx: TenantContext): Promise<{ providers: ProviderUsageSummary[] }> {
    const providers = await this.providerUsage.getUsage(ctx.tenantId);
    return { providers: filterProvidersForDeployment(providers) };
  }
}
