import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UnresolvedModel } from '../entities/unresolved-model.entity';
import { sqlNow } from '../common/utils/sql-dialect';

const FLUSH_INTERVAL_MS = 60_000;

@Injectable()
export class UnresolvedModelTrackerService implements OnModuleDestroy {
  private readonly logger = new Logger(UnresolvedModelTrackerService.name);
  private readonly pending = new Map<string, number>();
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    @InjectRepository(UnresolvedModel)
    private readonly unresolvedRepo: Repository<UnresolvedModel>,
  ) {
    this.flushTimer = setInterval(() => {
      this.flush().catch((err) => {
        this.logger.error(`Flush failed: ${err}`);
      });
    }, FLUSH_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  track(modelName: string): void {
    const current = this.pending.get(modelName) ?? 0;
    this.pending.set(modelName, current + 1);
  }

  async flush(): Promise<void> {
    if (this.pending.size === 0) return;

    const entries = [...this.pending.entries()];
    this.pending.clear();

    const now = sqlNow();
    for (const [modelName, count] of entries) {
      await this.upsertEntry(modelName, count, now);
    }

    this.logger.debug(`Flushed ${entries.length} unresolved model entries`);
  }

  private async upsertEntry(
    modelName: string,
    count: number,
    now: string,
  ): Promise<void> {
    const existing = await this.unresolvedRepo.findOneBy({
      model_name: modelName,
    });

    if (existing) {
      existing.occurrence_count += count;
      existing.last_seen = new Date(now);
      await this.unresolvedRepo.save(existing);
    } else {
      const entry = this.unresolvedRepo.create({
        model_name: modelName,
        first_seen: new Date(now),
        last_seen: new Date(now),
        occurrence_count: count,
        resolved: false,
      });
      await this.unresolvedRepo.save(entry);
    }
  }

  async getUnresolved(): Promise<UnresolvedModel[]> {
    return this.unresolvedRepo.find({
      where: { resolved: false },
      order: { occurrence_count: 'DESC' },
    });
  }

  async markResolved(
    modelName: string,
    resolvedTo: string,
  ): Promise<void> {
    await this.unresolvedRepo.update(
      { model_name: modelName },
      {
        resolved: true,
        resolved_to: resolvedTo,
        resolved_at: new Date(sqlNow()),
      },
    );
  }
}
