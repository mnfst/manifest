import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { SpecificityAssignment } from '../../entities/specificity-assignment.entity';
import { RoutingCacheService } from './routing-cache.service';

@Injectable()
export class SpecificityService {
  constructor(
    @InjectRepository(SpecificityAssignment)
    private readonly repo: Repository<SpecificityAssignment>,
    private readonly routingCache: RoutingCacheService,
  ) {}

  async getAssignments(agentId: string): Promise<SpecificityAssignment[]> {
    const cached = this.routingCache.getSpecificity(agentId);
    if (cached) return cached;

    const rows = await this.repo.find({ where: { agent_id: agentId } });
    this.routingCache.setSpecificity(agentId, rows);
    return rows;
  }

  async getActiveAssignments(agentId: string): Promise<SpecificityAssignment[]> {
    const all = await this.getAssignments(agentId);
    return all.filter((a) => a.is_active);
  }

  async toggleCategory(
    agentId: string,
    userId: string,
    category: string,
    active: boolean,
  ): Promise<SpecificityAssignment> {
    const existing = await this.repo.findOne({ where: { agent_id: agentId, category } });

    if (existing) {
      existing.is_active = active;
      existing.updated_at = new Date().toISOString();
      await this.repo.save(existing);
      this.routingCache.invalidateAgent(agentId);
      return existing;
    }

    const record = Object.assign(new SpecificityAssignment(), {
      id: randomUUID(),
      user_id: userId,
      agent_id: agentId,
      category,
      is_active: active,
      override_model: null,
      override_provider: null,
      override_auth_type: null,
      auto_assigned_model: null,
      fallback_models: null,
    });

    try {
      await this.repo.insert(record);
    } catch {
      const retry = await this.repo.findOne({ where: { agent_id: agentId, category } });
      if (retry) return this.toggleCategory(agentId, userId, category, active);
    }
    this.routingCache.invalidateAgent(agentId);
    return record;
  }

  async setOverride(
    agentId: string,
    userId: string,
    category: string,
    model: string,
    provider?: string,
    authType?: 'api_key' | 'subscription',
  ): Promise<SpecificityAssignment> {
    const existing = await this.repo.findOne({ where: { agent_id: agentId, category } });

    if (existing) {
      existing.override_model = model;
      existing.override_provider = provider ?? null;
      existing.override_auth_type = authType ?? null;
      existing.is_active = true;
      existing.updated_at = new Date().toISOString();
      await this.repo.save(existing);
      this.routingCache.invalidateAgent(agentId);
      return existing;
    }

    const record = Object.assign(new SpecificityAssignment(), {
      id: randomUUID(),
      user_id: userId,
      agent_id: agentId,
      category,
      is_active: true,
      override_model: model,
      override_provider: provider ?? null,
      override_auth_type: authType ?? null,
      auto_assigned_model: null,
      fallback_models: null,
    });

    try {
      await this.repo.insert(record);
    } catch {
      const retry = await this.repo.findOne({ where: { agent_id: agentId, category } });
      if (retry) return this.setOverride(agentId, userId, category, model, provider, authType);
    }
    this.routingCache.invalidateAgent(agentId);
    return record;
  }

  async clearOverride(agentId: string, category: string): Promise<void> {
    const existing = await this.repo.findOne({ where: { agent_id: agentId, category } });
    if (!existing) return;

    existing.override_model = null;
    existing.override_provider = null;
    existing.override_auth_type = null;
    existing.fallback_models = null;
    existing.updated_at = new Date().toISOString();
    await this.repo.save(existing);
    this.routingCache.invalidateAgent(agentId);
  }

  async setFallbacks(agentId: string, category: string, models: string[]): Promise<string[]> {
    const existing = await this.repo.findOne({ where: { agent_id: agentId, category } });
    if (!existing) return [];
    existing.fallback_models = models.length > 0 ? models : null;
    existing.updated_at = new Date().toISOString();
    await this.repo.save(existing);
    this.routingCache.invalidateAgent(agentId);
    return models;
  }

  async clearFallbacks(agentId: string, category: string): Promise<void> {
    const existing = await this.repo.findOne({ where: { agent_id: agentId, category } });
    if (!existing) return;
    existing.fallback_models = null;
    existing.updated_at = new Date().toISOString();
    await this.repo.save(existing);
    this.routingCache.invalidateAgent(agentId);
  }

  async resetAll(agentId: string): Promise<void> {
    await this.repo.update(
      { agent_id: agentId },
      {
        is_active: false,
        override_model: null,
        override_provider: null,
        override_auth_type: null,
        fallback_models: null,
        updated_at: new Date().toISOString(),
      },
    );
    this.routingCache.invalidateAgent(agentId);
  }
}
