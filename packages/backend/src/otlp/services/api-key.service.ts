import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { Tenant } from '../../entities/tenant.entity';
import { Agent } from '../../entities/agent.entity';
import { AgentApiKey } from '../../entities/agent-api-key.entity';
import { sha256, keyPrefix } from '../../common/utils/hash.util';
import { API_KEY_PREFIX } from '../../common/constants/api-key.constants';

@Injectable()
export class ApiKeyGeneratorService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(Agent)
    private readonly agentRepo: Repository<Agent>,
    @InjectRepository(AgentApiKey)
    private readonly keyRepo: Repository<AgentApiKey>,
  ) {}

  private generateKey(): string {
    return API_KEY_PREFIX + randomBytes(32).toString('base64url');
  }

  async onboardAgent(params: {
    tenantName: string;
    agentName: string;
    organizationName?: string;
    email?: string;
    agentDescription?: string;
    displayName?: string;
  }): Promise<{ tenantId: string; agentId: string; apiKey: string }> {
    const existing = await this.tenantRepo.findOne({
      where: { name: params.tenantName },
    });

    let tenantId: string;
    if (existing) {
      tenantId = existing.id;
    } else {
      tenantId = uuidv4();
      await this.tenantRepo.insert({
        id: tenantId,
        name: params.tenantName,
        organization_name: params.organizationName ?? null,
        email: params.email ?? null,
        is_active: true,
      });
    }

    const agentId = uuidv4();
    await this.agentRepo.insert({
      id: agentId,
      name: params.agentName,
      display_name: params.displayName ?? null,
      description: params.agentDescription ?? null,
      is_active: true,
      tenant_id: tenantId,
    });

    const rawKey = this.generateKey();
    const keyId = uuidv4();
    await this.keyRepo.insert({
      id: keyId,
      key: null,
      key_hash: sha256(rawKey),
      key_prefix: keyPrefix(rawKey),
      label: `${params.agentName} ingest key`,
      tenant_id: tenantId,
      agent_id: agentId,
      is_active: true,
    });

    return { tenantId, agentId, apiKey: rawKey };
  }

  async getKeyForAgent(
    userId: string,
    agentName: string,
  ): Promise<{ keyPrefix: string }> {
    const keyRecord = await this.keyRepo
      .createQueryBuilder('k')
      .leftJoin('k.agent', 'a')
      .leftJoin('a.tenant', 't')
      .where('t.name = :userId', { userId })
      .andWhere('a.name = :agentName', { agentName })
      .andWhere('k.is_active = true')
      .getOne();

    if (!keyRecord) {
      throw new NotFoundException('No active API key found for this agent');
    }
    return { keyPrefix: keyRecord.key_prefix };
  }

  async rotateKey(userId: string, agentName: string): Promise<{ apiKey: string }> {
    const agent = await this.agentRepo
      .createQueryBuilder('a')
      .leftJoin('a.tenant', 't')
      .where('a.name = :agentName', { agentName })
      .andWhere('t.name = :userId', { userId })
      .getOne();
    if (!agent) throw new NotFoundException('Agent not found or access denied');

    await this.keyRepo.delete({ agent_id: agent.id });

    const rawKey = this.generateKey();
    const keyId = uuidv4();
    await this.keyRepo.insert({
      id: keyId,
      key: null,
      key_hash: sha256(rawKey),
      key_prefix: keyPrefix(rawKey),
      label: `${agent.name} ingest key (rotated)`,
      tenant_id: agent.tenant_id,
      agent_id: agent.id,
      is_active: true,
    });

    return { apiKey: rawKey };
  }
}
