import { Controller, Get, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.instance';
import { UserProvider } from '../entities/user-provider.entity';
import { AgentMessage } from '../entities/agent-message.entity';
import { Tenant } from '../entities/tenant.entity';
import { ModelPricingCacheService } from '../model-prices/model-pricing-cache.service';
import { decrypt, getEncryptionSecret } from '../common/utils/crypto.util';

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
  private readonly logger = new Logger(UserProvidersController.name);

  @Get()
  async listProviders(@CurrentUser() user: AuthUser) {
    let providers = await this.providerRepo.find({
      where: { user_id: user.id },
    });

    // Deduplicate connections sharing the same API key for the same (provider, auth_type).
    // This cleans up historical duplicates from OAuth reconnects.
    providers = await this.deduplicateConnections(providers);

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
          is_active: boolean;
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
          is_active: p.is_active,
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
              is_active: p.is_active,
            },
          ],
          total_models: modelCount,
        });
      }
    }

    // Get consumption per provider (last 30 days) + last used timestamp (all time)
    let consumption = new Map<
      string,
      { tokens: number; messages: number; cost: number; last_used_at: string | null }
    >();
    if (tenant) {
      const rows = await this.messageRepo
        .createQueryBuilder('m')
        .select('m.provider', 'provider')
        .addSelect('m.auth_type', 'auth_type')
        .addSelect('SUM(COALESCE(m.input_tokens, 0) + COALESCE(m.output_tokens, 0))', 'tokens')
        .addSelect('COUNT(*)', 'messages')
        .addSelect('SUM(COALESCE(m.cost_usd, 0))', 'cost')
        .addSelect('MAX(m.timestamp)', 'last_used_at')
        .where('m.tenant_id = :tenantId', { tenantId: tenant.id })
        .andWhere("m.timestamp >= NOW() - INTERVAL '30 days'")
        .groupBy('m.provider')
        .addGroupBy('m.auth_type')
        .getRawMany();

      for (const row of rows) {
        if (row.provider) {
          const lastUsed =
            row.last_used_at instanceof Date
              ? row.last_used_at.toISOString()
              : row.last_used_at
                ? String(row.last_used_at)
                : null;
          consumption.set(`${row.provider}::${row.auth_type ?? 'api_key'}`, {
            tokens: parseInt(row.tokens, 10) || 0,
            messages: parseInt(row.messages, 10) || 0,
            cost: parseFloat(row.cost) || 0,
            last_used_at: lastUsed,
          });
        }
      }
    }

    // 7-day daily token sparkline per (provider, auth_type)
    const sparklines = new Map<string, number[]>();
    if (tenant) {
      const sparkRows = await this.messageRepo
        .createQueryBuilder('m')
        .select('m.provider', 'provider')
        .addSelect('m.auth_type', 'auth_type')
        .addSelect("to_char(date_trunc('day', m.timestamp), 'YYYY-MM-DD')", 'day')
        .addSelect('COALESCE(SUM(m.input_tokens + m.output_tokens), 0)', 'tokens')
        .where('m.tenant_id = :tenantId', { tenantId: tenant.id })
        .andWhere("m.timestamp >= NOW() - INTERVAL '7 days'")
        .groupBy('m.provider')
        .addGroupBy('m.auth_type')
        .addGroupBy('day')
        .orderBy('day', 'ASC')
        .getRawMany();

      // Build a 7-element array for each provider key
      const today = new Date();
      const days: string[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        days.push(d.toISOString().slice(0, 10));
      }

      const byKey = new Map<string, Map<string, number>>();
      for (const r of sparkRows) {
        if (!r.provider) continue;
        const key = `${r.provider}::${r.auth_type ?? 'api_key'}`;
        if (!byKey.has(key)) byKey.set(key, new Map());
        byKey.get(key)!.set(String(r.day), Number(r.tokens) || 0);
      }
      for (const [key, dayMap] of byKey) {
        sparklines.set(
          key,
          days.map((d) => dayMap.get(d) ?? 0),
        );
      }
    }

    const result = Array.from(grouped.values()).map((g) => {
      const cons = consumption.get(`${g.provider}::${g.auth_type}`) ?? {
        tokens: 0,
        messages: 0,
        cost: 0,
        last_used_at: null,
      };
      return {
        provider: g.provider,
        auth_type: g.auth_type,
        connection_count: g.connections.length,
        connections: g.connections,
        total_models: g.total_models,
        consumption_tokens: cons.tokens,
        consumption_messages: cons.messages,
        consumption_cost: cons.cost,
        last_used_at: cons.last_used_at,
        sparkline_7d: sparklines.get(`${g.provider}::${g.auth_type}`) ?? [],
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

  /**
   * Detect and remove duplicate connections that share the same encrypted API key
   * for the same (provider, auth_type). Keeps the connection with the most cached models
   * (or the oldest one as tiebreaker). Deletes the rest from the database.
   */
  private async deduplicateConnections(providers: UserProvider[]): Promise<UserProvider[]> {
    const secret = getEncryptionSecret();
    const byKey = new Map<string, UserProvider[]>();

    for (const p of providers) {
      if (!p.api_key_encrypted) continue;
      let plain: string;
      try {
        plain = decrypt(p.api_key_encrypted, secret);
      } catch {
        continue;
      }
      const groupKey = `${p.provider}::${p.auth_type}::${plain}`;
      const list = byKey.get(groupKey);
      if (list) list.push(p);
      else byKey.set(groupKey, [p]);
    }

    const toDelete: string[] = [];
    for (const dupes of byKey.values()) {
      if (dupes.length <= 1) continue;
      // Keep the one with most models, then oldest connected_at as tiebreaker
      dupes.sort((a, b) => {
        const modelsA = Array.isArray(a.cached_models) ? a.cached_models.length : 0;
        const modelsB = Array.isArray(b.cached_models) ? b.cached_models.length : 0;
        if (modelsB !== modelsA) return modelsB - modelsA;
        return new Date(a.connected_at).getTime() - new Date(b.connected_at).getTime();
      });
      for (let i = 1; i < dupes.length; i++) {
        toDelete.push(dupes[i]!.id);
      }
    }

    if (toDelete.length > 0) {
      this.logger.log(`Deduplicating ${toDelete.length} duplicate provider connection(s)`);
      await this.providerRepo.delete(toDelete);
      return providers.filter((p) => !toDelete.includes(p.id));
    }
    return providers;
  }
}
