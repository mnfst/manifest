import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';
import type {
  AuthType,
  BenchmarkHistoryColumn,
  BenchmarkHistoryRunDetail,
  BenchmarkHistoryRunSummary,
} from 'manifest-shared';
import { BenchmarkRun } from '../entities/benchmark-run.entity';
import { BenchmarkColumn } from '../entities/benchmark-column.entity';

export interface SaveColumnInput {
  userId: string;
  agent: { id: string; tenant_id: string; name: string };
  runId?: string;
  prompt: string;
  model: string;
  provider: string;
  authType: AuthType | null;
  displayName: string | null;
  position: number;
  status: 'success' | 'error';
  content: string | null;
  headers: Record<string, string> | null;
  errorMessage: string | null;
  metrics: {
    inputTokens: number;
    outputTokens: number;
    cost: number | null;
    durationMs: number;
  } | null;
}

/** Soft cap on stored runs per (user, agent) pair; oldest pruned on insert. */
export const MAX_RUNS_PER_AGENT = 50;

@Injectable()
export class BenchmarkHistoryService {
  private readonly logger = new Logger(BenchmarkHistoryService.name);

  constructor(
    @InjectRepository(BenchmarkRun)
    private readonly runRepo: Repository<BenchmarkRun>,
    @InjectRepository(BenchmarkColumn)
    private readonly columnRepo: Repository<BenchmarkColumn>,
  ) {}

  async saveColumn(input: SaveColumnInput): Promise<void> {
    const runId = input.runId ?? uuid();

    const insertedRun = await this.ensureRun(runId, input);

    try {
      await this.columnRepo.insert({
        id: uuid(),
        benchmark_run_id: runId,
        model: input.model,
        provider: input.provider,
        auth_type: input.authType,
        display_name: input.displayName,
        status: input.status,
        content: input.content,
        headers: input.headers,
        error_message: input.errorMessage,
        input_tokens: input.metrics?.inputTokens ?? null,
        output_tokens: input.metrics?.outputTokens ?? null,
        cost_usd: input.metrics?.cost ?? null,
        duration_ms: input.metrics?.durationMs ?? null,
        position: input.position,
        created_at: new Date().toISOString(),
      });
    } catch (err) {
      this.logger.warn(
        `Failed to persist benchmark history column: ${err instanceof Error ? err.message : err}`,
      );
      return;
    }

    if (insertedRun) {
      try {
        await this.pruneOldRuns(input.userId, input.agent.id);
      } catch (err) {
        this.logger.warn(
          `Failed to prune old benchmark runs: ${err instanceof Error ? err.message : err}`,
        );
      }
    }
  }

  /**
   * Idempotent run-row creation. Multiple columns of the same UI submit fan
   * out concurrently and share `runId`; without `ON CONFLICT DO NOTHING` the
   * losers race-fail with a primary-key violation and we silently drop their
   * column inserts. Returns whether *this* call inserted the row, so the
   * caller knows when it owns the prune.
   */
  private async ensureRun(runId: string, input: SaveColumnInput): Promise<boolean> {
    try {
      const result = await this.runRepo
        .createQueryBuilder()
        .insert()
        .into('benchmark_runs')
        .values({
          id: runId,
          tenant_id: input.agent.tenant_id,
          user_id: input.userId,
          agent_id: input.agent.id,
          agent_name: input.agent.name,
          prompt: input.prompt.slice(0, 10_000),
          created_at: new Date().toISOString(),
        })
        .orIgnore()
        .execute();
      return (result.identifiers ?? []).length > 0;
    } catch (err) {
      this.logger.warn(
        `Failed to ensure benchmark run row: ${err instanceof Error ? err.message : err}`,
      );
      return false;
    }
  }

  async listRuns(userId: string, agentId: string): Promise<BenchmarkHistoryRunSummary[]> {
    const runs = await this.runRepo.find({
      where: { user_id: userId, agent_id: agentId },
      order: { created_at: 'DESC' },
      take: MAX_RUNS_PER_AGENT,
    });
    if (runs.length === 0) return [];

    const columns = await this.columnRepo.find({
      where: { benchmark_run_id: In(runs.map((r) => r.id)) },
      select: ['benchmark_run_id', 'model', 'display_name', 'position'],
      order: { position: 'ASC' },
    });

    const modelsByRun = new Map<string, string[]>();
    for (const c of columns) {
      const bucket = modelsByRun.get(c.benchmark_run_id) ?? [];
      bucket.push(c.display_name ?? c.model);
      modelsByRun.set(c.benchmark_run_id, bucket);
    }

    return runs.map((r) => {
      const models = modelsByRun.get(r.id) ?? [];
      return {
        id: r.id,
        prompt: r.prompt,
        createdAt: r.created_at,
        modelCount: models.length,
        models,
        starred: r.starred,
      };
    });
  }

  async getRun(
    userId: string,
    runId: string,
    agentId?: string,
  ): Promise<BenchmarkHistoryRunDetail> {
    const where: { id: string; user_id: string; agent_id?: string } = {
      id: runId,
      user_id: userId,
    };
    if (agentId) where.agent_id = agentId;
    const run = await this.runRepo.findOne({ where });
    if (!run) throw new NotFoundException(`Benchmark run "${runId}" not found`);

    const columns = await this.columnRepo.find({
      where: { benchmark_run_id: runId },
      order: { position: 'ASC' },
    });

    return {
      id: run.id,
      prompt: run.prompt,
      createdAt: run.created_at,
      modelCount: columns.length,
      models: columns.map((c) => c.display_name ?? c.model),
      starred: run.starred,
      columns: columns.map((c): BenchmarkHistoryColumn => {
        const hasMetrics =
          c.status === 'success' &&
          c.input_tokens != null &&
          c.output_tokens != null &&
          c.duration_ms != null;
        return {
          id: c.id,
          model: c.model,
          provider: c.provider,
          authType: (c.auth_type ?? null) as BenchmarkHistoryColumn['authType'],
          displayName: c.display_name,
          status: c.status === 'success' ? 'success' : 'error',
          content: c.content,
          headers: c.headers,
          errorMessage: c.error_message,
          metrics: hasMetrics
            ? {
                inputTokens: c.input_tokens!,
                outputTokens: c.output_tokens!,
                cost: c.cost_usd != null ? Number(c.cost_usd) : null,
                durationMs: c.duration_ms!,
              }
            : null,
          position: c.position,
        };
      }),
    };
  }

  async toggleStar(userId: string, runId: string): Promise<boolean> {
    const result = await this.runRepo
      .createQueryBuilder()
      .update(BenchmarkRun)
      .set({ starred: () => 'NOT starred' })
      .where('id = :runId AND user_id = :userId', { runId, userId })
      .returning('starred')
      .execute();

    if (result.affected === 0) {
      throw new NotFoundException(`Benchmark run "${runId}" not found`);
    }

    return result.raw[0].starred;
  }

  private async pruneOldRuns(userId: string, agentId: string): Promise<void> {
    const surplus = await this.runRepo
      .createQueryBuilder('r')
      .select('r.id', 'id')
      .where('r.user_id = :userId', { userId })
      .andWhere('r.agent_id = :agentId', { agentId })
      .orderBy('r.created_at', 'DESC')
      .offset(MAX_RUNS_PER_AGENT)
      .getRawMany<{ id: string }>();
    if (surplus.length === 0) return;
    await this.runRepo.delete({ id: In(surplus.map((s) => s.id)) });
  }
}
