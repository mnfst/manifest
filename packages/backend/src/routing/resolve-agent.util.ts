import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Agent } from '../entities/agent.entity';
import { Tenant } from '../entities/tenant.entity';

export async function resolveAgent(
  tenantRepo: Repository<Tenant>,
  agentRepo: Repository<Agent>,
  userId: string,
  agentName: string,
): Promise<Agent> {
  const tenant = await tenantRepo.findOne({ where: { name: userId } });
  if (!tenant) throw new NotFoundException('Tenant not found');
  const agent = await agentRepo.findOne({
    where: { tenant_id: tenant.id, name: agentName },
  });
  if (!agent) throw new NotFoundException(`Agent "${agentName}" not found`);
  return agent;
}
