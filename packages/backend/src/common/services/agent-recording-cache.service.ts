import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Agent } from '../../entities/agent.entity';
import { TtlFifoCache } from '../utils/ttl-fifo-cache';

@Injectable()
export class AgentRecordingCacheService {
  // 5s TTL: this cache exists to skip a hot-path SELECT on every proxy call,
  // not to be a long-lived store. A short TTL keeps consent-withdrawal lag
  // bounded — when a user toggles `record_messages` off, the worst-case
  // window before all replicas honor the new value is ~TTL. Manifest is
  // documented as single-service, but the same controller can run with
  // multiple workers in production; making the window short is the
  // simplest correctness story.
  private readonly cache = new TtlFifoCache<string, boolean>({
    maxEntries: 5_000,
    ttlMs: 5_000,
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
