import { Controller, Get } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.instance';
import { UserProvider } from '../entities/user-provider.entity';
import { AgentMessage } from '../entities/agent-message.entity';
import { Tenant } from '../entities/tenant.entity';
import { ModelPricingCacheService } from '../model-prices/model-pricing-cache.service';

/**
 * User-level provider management endpoints.
 * Returns all providers for the authenticated user (not scoped to a specific agent).
 */
@Controller('api/v1/providers')
export class UserProvidersController {
  constructor(
    @InjectRepository(UserProvider)
    private readonly providerRepo: Repository<UserProvider>,
    @InjectRepository(AgentMessage)
    private readonly messageRepo: Repository<AgentMessage>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    private readonly pricingCache: ModelPricingCacheService,
  ) {}

  /**
   * List all user-level providers with consumption summary.
   * Groups by (provider, auth_type) and returns connected count, model count,
   * and aggregate token consumption for the current period.
   */
  @Get()
  async listProviders(@CurrentUser() user: AuthUser) {
    const providers = await this.providerRepo.find({
      where: { user_id: user.id, is_active: true },
    });

    // Get tenant for message queries
    const tenant = await this.tenantRepo.findOne({ where: { name: user.id } });

    // Group providers and build response
    const grouped = new Map<
      string,
      {
        provider: string;
        auth_type: string;
        connections: Array<{
          id: string;
          label: string;
          key_prefix: string | null;
          priority: number;
          connected_at: string;
          models_fetched_at: string | null;
          cached_model_count: number;
        }>;
        total_models: number;
      }
    >();

    for (const p of providers) {
      const key = `${p.provider}::${p.auth_type}`;
      const existing = grouped.get(key);
      const modelCount = Array.isArray(p.cached_models) ? p.cached_models.length : 0;

      if (existing) {
        existing.connections.push({
          id: p.id,
          label: p.label,
          key_prefix: p.key_prefix,
          priority: p.priority,
          connected_at: p.connected_at,
          models_fetched_at: p.models_fetched_at,
          cached_model_count: modelCount,
        });
        existing.total_models = Math.max(existing.total_models, modelCount);
      } else {
        grouped.set(key, {
          provider: p.provider,
          auth_type: p.auth_type,
          connections: [
            {
              id: p.id,
              label: p.label,
              key_prefix: p.key_prefix,
              priority: p.priority,
              connected_at: p.connected_at,
              models_fetched_at: p.models_fetched_at,
              cached_model_count: modelCount,
            },
          ],
          total_models: modelCount,
        });
      }
    }

    // Get consumption per provider (last 30 days)
    let consumption = new Map<string, { tokens: number; messages: number }>();
    if (tenant) {
      const rows = await this.messageRepo
        .createQueryBuilder('m')
        .select('m.provider', 'provider')
        .addSelect('m.auth_type', 'auth_type')
        .addSelect('SUM(COALESCE(m.input_tokens, 0) + COALESCE(m.output_tokens, 0))', 'tokens')
        .addSelect('COUNT(*)', 'messages')
        .where('m.tenant_id = :tenantId', { tenantId: tenant.id })
        .andWhere("m.timestamp >= NOW() - INTERVAL '30 days'")
        .groupBy('m.provider')
        .addGroupBy('m.auth_type')
        .getRawMany();

      for (const row of rows) {
        if (row.provider) {
          consumption.set(`${row.provider}::${row.auth_type ?? 'api_key'}`, {
            tokens: parseInt(row.tokens, 10) || 0,
            messages: parseInt(row.messages, 10) || 0,
          });
        }
      }
    }

    const result = Array.from(grouped.values()).map((g) => {
      const cons = consumption.get(`${g.provider}::${g.auth_type}`) ?? {
        tokens: 0,
        messages: 0,
      };
      return {
        provider: g.provider,
        auth_type: g.auth_type,
        connection_count: g.connections.length,
        connections: g.connections,
        total_models: g.total_models,
        consumption_tokens: cons.tokens,
        consumption_messages: cons.messages,
      };
    });

    // Count models per provider from the global pricing cache (covers all providers, connected or not)
    const allPricing = this.pricingCache.getAll();
    const modelCountByProvider = new Map<string, number>();
    for (const entry of allPricing) {
      const prov = entry.provider?.toLowerCase();
      if (prov) {
        modelCountByProvider.set(prov, (modelCountByProvider.get(prov) ?? 0) + 1);
      }
    }

    return {
      providers: result,
      model_counts: Object.fromEntries(modelCountByProvider),
    };
  }
}
