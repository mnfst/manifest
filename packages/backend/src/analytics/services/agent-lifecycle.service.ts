import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Agent } from '../../entities/agent.entity';

@Injectable()
export class AgentLifecycleService {
  constructor(
    @InjectRepository(Agent)
    private readonly agentRepo: Repository<Agent>,
    private readonly dataSource: DataSource,
  ) {}

  async deleteAgent(userId: string, agentName: string): Promise<void> {
    const agent = await this.agentRepo
      .createQueryBuilder('a')
      .leftJoin('a.tenant', 't')
      .where('t.name = :userId', { userId })
      .andWhere('a.name = :agentName', { agentName })
      .getOne();

    if (!agent) {
      throw new NotFoundException(`Agent "${agentName}" not found`);
    }
    await this.agentRepo.delete(agent.id);
  }

  private async findAgentByUser(userId: string, agentName: string) {
    return this.agentRepo
      .createQueryBuilder('a')
      .leftJoin('a.tenant', 't')
      .where('t.name = :userId', { userId })
      .andWhere('a.name = :agentName', { agentName })
      .getOne();
  }

  async updateAgentType(
    userId: string,
    agentName: string,
    fields: { agent_category?: string; agent_platform?: string },
  ): Promise<void> {
    const agent = await this.findAgentByUser(userId, agentName);
    if (!agent) throw new NotFoundException(`Agent "${agentName}" not found`);

    const update: Record<string, unknown> = {};
    if (fields.agent_category !== undefined) update['agent_category'] = fields.agent_category;
    if (fields.agent_platform !== undefined) update['agent_platform'] = fields.agent_platform;
    if (Object.keys(update).length === 0) return;

    await this.agentRepo
      .createQueryBuilder()
      .update('agents')
      .set(update)
      .where('id = :id', { id: agent.id })
      .execute();
  }

  async renameAgent(
    userId: string,
    currentName: string,
    newName: string,
    displayName?: string,
  ): Promise<void> {
    const agent = await this.agentRepo
      .createQueryBuilder('a')
      .leftJoin('a.tenant', 't')
      .where('t.name = :userId', { userId })
      .andWhere('a.name = :currentName', { currentName })
      .getOne();

    if (!agent) {
      throw new NotFoundException(`Agent "${currentName}" not found`);
    }

    // If only display_name changes (same slug), short-circuit
    if (newName === currentName) {
      if (displayName !== undefined) {
        await this.agentRepo
          .createQueryBuilder()
          .update('agents')
          .set({ display_name: displayName })
          .where('id = :id', { id: agent.id })
          .execute();
      }
      return;
    }

    const duplicate = await this.agentRepo
      .createQueryBuilder('a')
      .leftJoin('a.tenant', 't')
      .where('t.name = :userId', { userId })
      .andWhere('a.name = :newName', { newName })
      .getOne();

    if (duplicate) {
      throw new ConflictException(`Agent "${newName}" already exists`);
    }

    await this.dataSource.transaction(async (manager) => {
      const agentUpdate: Record<string, unknown> = { name: newName };
      if (displayName !== undefined) agentUpdate['display_name'] = displayName;

      await manager
        .createQueryBuilder()
        .update('agents')
        .set(agentUpdate)
        .where('id = :id', { id: agent.id })
        .execute();

      const tables = ['agent_messages', 'notification_rules', 'notification_logs'];
      await Promise.all(
        tables.map((table) =>
          manager
            .createQueryBuilder()
            .update(table)
            .set({ agent_name: newName })
            .where('agent_name = :currentName', { currentName })
            .execute(),
        ),
      );
    });
  }
}
