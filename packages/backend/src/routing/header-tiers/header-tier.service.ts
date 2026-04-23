import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { TIER_COLORS, type TierColor } from 'manifest-shared';
import { HeaderTier } from '../../entities/header-tier.entity';
import { RoutingCacheService } from '../routing-core/routing-cache.service';

export const RESERVED_HEADER_KEYS = new Set<string>([
  'authorization',
  'cookie',
  'set-cookie',
  'proxy-authorization',
  'x-api-key',
]);

const HEADER_KEY_RE = /^[a-z0-9-]+$/;
const MAX_NAME_LEN = 32;
const MAX_HEADER_VALUE_LEN = 128;

export interface CreateHeaderTierInput {
  name: string;
  header_key: string;
  header_value: string;
  badge_color: TierColor;
}

export interface UpdateHeaderTierInput {
  name?: string;
  header_key?: string;
  header_value?: string;
  badge_color?: TierColor;
}

@Injectable()
export class HeaderTierService {
  constructor(
    @InjectRepository(HeaderTier)
    private readonly repo: Repository<HeaderTier>,
    private readonly routingCache: RoutingCacheService,
  ) {}

  async list(agentId: string): Promise<HeaderTier[]> {
    const cached = this.routingCache.getHeaderTiers(agentId);
    if (cached) return cached;
    const rows = await this.repo.find({
      where: { agent_id: agentId },
      order: { sort_order: 'ASC' },
    });
    this.routingCache.setHeaderTiers(agentId, rows);
    return rows;
  }

  async create(
    agentId: string,
    userId: string,
    tenantId: string | null,
    input: CreateHeaderTierInput,
  ): Promise<HeaderTier> {
    const name = this.validateName(input.name);
    const headerKey = this.validateHeaderKey(input.header_key);
    const headerValue = this.validateHeaderValue(input.header_value);
    const badgeColor = this.validateColor(input.badge_color);

    const existing = await this.repo.find({ where: { agent_id: agentId } });
    this.assertNameAvailable(existing, name);
    this.assertRuleAvailable(existing, headerKey, headerValue);

    const nextOrder =
      existing.reduce((max, t) => (t.sort_order > max ? t.sort_order : max), -1) + 1;
    const now = new Date().toISOString();

    const record = Object.assign(new HeaderTier(), {
      id: randomUUID(),
      tenant_id: tenantId,
      agent_id: agentId,
      user_id: userId,
      name,
      header_key: headerKey,
      header_value: headerValue,
      badge_color: badgeColor,
      sort_order: nextOrder,
      enabled: true,
      override_model: null,
      override_provider: null,
      override_auth_type: null,
      fallback_models: null,
      created_at: now,
      updated_at: now,
    });
    await this.repo.insert(record);
    this.routingCache.invalidateAgent(agentId);
    return record;
  }

  async update(agentId: string, id: string, patch: UpdateHeaderTierInput): Promise<HeaderTier> {
    const row = await this.findOrThrow(agentId, id);
    const siblings = (await this.repo.find({ where: { agent_id: agentId } })).filter(
      (t) => t.id !== id,
    );
    if (patch.name !== undefined) {
      const next = this.validateName(patch.name);
      this.assertNameAvailable(siblings, next);
      row.name = next;
    }
    if (patch.header_key !== undefined) {
      row.header_key = this.validateHeaderKey(patch.header_key);
    }
    if (patch.header_value !== undefined) {
      row.header_value = this.validateHeaderValue(patch.header_value);
    }
    if (patch.badge_color !== undefined) {
      row.badge_color = this.validateColor(patch.badge_color);
    }
    this.assertRuleAvailable(siblings, row.header_key, row.header_value);
    row.updated_at = new Date().toISOString();
    await this.repo.save(row);
    this.routingCache.invalidateAgent(agentId);
    return row;
  }

  async setEnabled(agentId: string, id: string, enabled: boolean): Promise<HeaderTier> {
    const row = await this.findOrThrow(agentId, id);
    row.enabled = enabled;
    row.updated_at = new Date().toISOString();
    await this.repo.save(row);
    this.routingCache.invalidateAgent(agentId);
    return row;
  }

  async delete(agentId: string, id: string): Promise<void> {
    const row = await this.findOrThrow(agentId, id);
    await this.repo.delete({ id: row.id });
    this.routingCache.invalidateAgent(agentId);
  }

  async reorder(agentId: string, ids: string[]): Promise<void> {
    if (!Array.isArray(ids)) {
      throw new BadRequestException('reorder: ids must be an array');
    }
    const rows = await this.repo.find({ where: { agent_id: agentId } });
    // Bound the loop by the DB-backed tier count, not the user-supplied array
    // length, so a pathological payload can't turn this into an O(user-input)
    // loop (CodeQL: js/loop-bound-injection).
    if (ids.length !== rows.length) {
      throw new BadRequestException('reorder list must include every existing tier exactly once');
    }
    // A Set trims duplicates; if its size still matches the array length, each
    // id was unique. Without this, `[a, a]` on a two-tier agent would pass the
    // length check and silently leave one tier out of the reorder.
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('reorder list must not contain duplicate ids');
    }
    const byId = new Map(rows.map((r) => [r.id, r]));
    if (!ids.every((id) => byId.has(id))) {
      throw new BadRequestException('reorder list must include every existing tier exactly once');
    }
    const now = new Date().toISOString();
    for (let i = 0; i < rows.length; i++) {
      const row = byId.get(ids[i])!;
      row.sort_order = i;
      row.updated_at = now;
    }
    await this.repo.save([...byId.values()]);
    this.routingCache.invalidateAgent(agentId);
  }

  async setOverride(
    agentId: string,
    id: string,
    model: string,
    provider?: string,
    authType?: 'api_key' | 'subscription',
  ): Promise<HeaderTier> {
    const row = await this.findOrThrow(agentId, id);
    row.override_model = model;
    row.override_provider = provider ?? null;
    row.override_auth_type = authType ?? null;
    row.updated_at = new Date().toISOString();
    await this.repo.save(row);
    this.routingCache.invalidateAgent(agentId);
    return row;
  }

  async clearOverride(agentId: string, id: string): Promise<void> {
    const row = await this.findOrThrow(agentId, id);
    row.override_model = null;
    row.override_provider = null;
    row.override_auth_type = null;
    row.fallback_models = null;
    row.updated_at = new Date().toISOString();
    await this.repo.save(row);
    this.routingCache.invalidateAgent(agentId);
  }

  async setFallbacks(agentId: string, id: string, models: string[]): Promise<string[]> {
    const row = await this.findOrThrow(agentId, id);
    row.fallback_models = models.length > 0 ? models : null;
    row.updated_at = new Date().toISOString();
    await this.repo.save(row);
    this.routingCache.invalidateAgent(agentId);
    return models;
  }

  async clearFallbacks(agentId: string, id: string): Promise<void> {
    const row = await this.findOrThrow(agentId, id);
    row.fallback_models = null;
    row.updated_at = new Date().toISOString();
    await this.repo.save(row);
    this.routingCache.invalidateAgent(agentId);
  }

  private async findOrThrow(agentId: string, id: string): Promise<HeaderTier> {
    const row = await this.repo.findOne({ where: { id, agent_id: agentId } });
    if (!row) throw new NotFoundException('Header tier not found');
    return row;
  }

  private validateName(raw: string): string {
    const name = (raw ?? '').trim();
    if (!name) throw new BadRequestException('Name is required');
    if (name.length > MAX_NAME_LEN) {
      throw new BadRequestException(`Name must be ${MAX_NAME_LEN} characters or fewer`);
    }
    return name;
  }

  private validateHeaderKey(raw: string): string {
    const key = (raw ?? '').trim().toLowerCase();
    if (!key) throw new BadRequestException('Header key is required');
    if (!HEADER_KEY_RE.test(key)) {
      throw new BadRequestException(
        `Header keys can only contain lowercase letters, digits, and hyphens`,
      );
    }
    if (RESERVED_HEADER_KEYS.has(key)) {
      throw new BadRequestException(
        `This header is stripped for security and can't be used as a match rule`,
      );
    }
    return key;
  }

  private validateHeaderValue(raw: string): string {
    const val = (raw ?? '').trim();
    if (!val) throw new BadRequestException('Header value is required');
    if (val.length > MAX_HEADER_VALUE_LEN) {
      throw new BadRequestException(
        `Header value must be ${MAX_HEADER_VALUE_LEN} characters or fewer`,
      );
    }
    return val;
  }

  private validateColor(raw: TierColor): TierColor {
    if (!TIER_COLORS.includes(raw)) {
      throw new BadRequestException(`Invalid badge color — pick one of ${TIER_COLORS.join(', ')}`);
    }
    return raw;
  }

  private assertNameAvailable(existing: HeaderTier[], name: string): void {
    const lower = name.toLowerCase();
    if (existing.some((t) => t.name.toLowerCase() === lower)) {
      throw new BadRequestException('A tier with this name already exists');
    }
  }

  private assertRuleAvailable(existing: HeaderTier[], key: string, value: string): void {
    if (existing.some((t) => t.header_key === key && t.header_value === value)) {
      throw new BadRequestException(
        'Another tier already matches this header key and value combination',
      );
    }
  }
}
