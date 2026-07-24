import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Agent } from '../../entities/agent.entity';
import { TtlFifoCache } from '../utils/ttl-fifo-cache';

@Injectable()
export class AgentRecordingCacheService {
  private readonly cache = new TtlFifoCache<string, boolean>({
    maxEntries: 5_000,
    ttlMs: 60_000,
  });

  constructor(
    @InjectRepository(Agent)
    private readonly agentRepo: Repository<Agent>,
  ) {}

  async isRecording(agentId: string | null | undefined): Promise<boolean> {
    if (!agentId) return false;
    return this.cache.resolve(agentId, async (id) => {
      const agent = await this.agentRepo.findOne({
        where: { id },
        select: ['id', 'record_messages'],
      });
      return agent?.record_messages === true;
    });
  }

  invalidate(agentId: string): void {
    this.cache.invalidate(agentId);
  }
}
