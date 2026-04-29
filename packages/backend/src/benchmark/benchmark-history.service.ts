import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository, SelectQueryBuilder } from 'typeorm';
import { v4 as uuid } from 'uuid';
import type {
  BenchmarkHistoryColumn,
  BenchmarkHistoryRunDetail,
  BenchmarkHistoryRunSummary,
} from 'manifest-shared';
import { BenchmarkRun } from '../entities/benchmark-run.entity';
import { BenchmarkColumn } from '../entities/benchmark-column.entity';
import { TenantCacheService } from '../common/services/tenant-cache.service';

export interface SaveColumnInput {
  userId: string;
  agent: { id: string; tenant_id: string; name: string };
  runId?: string;
  prompt: string;
  model: string;
  provider: string;
  authType: 'api_key' | 'subscription' | null;
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
/** Hard cap on a single prune fetch. Prevents pathological loads if the prune was skipped for a long time. */
export const PRUNE_BATCH_LIMIT = 500;

@Injectable()
export class BenchmarkHistoryService {
  private readonly logger = new Logger(BenchmarkHistoryService.name);

  constructor(
    @InjectRepository(BenchmarkRun)
    private readonly runRepo: Repository<BenchmarkRun>,
    @InjectRepository(BenchmarkColumn)
    private readonly columnRepo: Repository<BenchmarkColumn>,
    private readonly tenantCache: TenantCacheService,
  ) {}

  /**
   * Apply the project's standard ownership predicate: tenant_id is the
   * preferred filter, with user_id as a fallback for users who don't yet
   * have a tenant row. Mirrors `addTenantFilter` in analytics/query-helpers.
   */
  private applyOwnership(
    qb: SelectQueryBuilder<BenchmarkRun>,
    userId: string,
    tenantId: string | null,
  ): SelectQueryBuilder<BenchmarkRun> {
    if (tenantId) {
      qb.andWhere('r.tenant_id = :tenantId', { tenantId });
    } else {
      qb.andWhere('r.user_id = :userId', { userId });
    }
    return qb;
  }

  async saveColumn(input: SaveColumnInput, manager?: EntityManager): Promise<void> {
    // When `manager` is supplied, all writes share that transaction with the
    // caller's `agent_messages` insert. Without it, callers see two
    // independent commits and a crash between can leave the message visible
    // without a history row.
    const runRepo = manager ? manager.getRepository(BenchmarkRun) : this.runRepo;
    const columnRepo = manager ? manager.getRepository(BenchmarkColumn) : this.columnRepo;

    const runId = input.runId ?? uuid();
    let inserted: boolean;
    try {
      inserted = await this.ensureRun(runId, input, runRepo);
    } catch (err) {
      // Surface inside a transaction so the caller can roll back; swallow on
      // the bare path so a one-off run-insert hiccup doesn't blow up the
      // user's response.
      if (manager) throw err;
      return;
    }

    try {
      await columnRepo.insert({
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
      // Inside a transaction, propagate so the caller can roll back the
      // agent_messages row too — best-effort only applies to the bare
      // (no-tx) call path.
      if (manager) throw err;
      return;
    }

    if (inserted) {
      // Prune AFTER the column is persisted so a prune failure can never lose
      // the column we just generated (history is best-effort, but the column
      // is the actual user-visible artifact). Skip prune inside a transaction
      // — pruning is independent of the current write and shouldn't be
      // bundled into the caller's commit window.
      if (!manager) {
        try {
          await this.pruneOldRuns(input.userId, input.agent.id);
        } catch (err) {
          this.logger.warn(
            `Failed to prune old benchmark runs: ${err instanceof Error ? err.message : err}`,
          );
        }
      }
    }
  }

  /**
   * Idempotent run-row creation. Multiple columns of the same UI submit fan
   * out concurrently and share `runId`; without `ON CONFLICT DO NOTHING` the
   * losers race-fail with a primary-key violation and we silently drop their
   * column inserts. Returns whether *this* call inserted the run (so the
   * caller knows if it owns the prune).
   */
  private async ensureRun(
    runId: string,
    input: SaveColumnInput,
    runRepo: Repository<BenchmarkRun>,
  ): Promise<boolean> {
    try {
      const result = await runRepo
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
      // Inside a transaction the caller cares whether the column write
      // succeeded — surface the failure so the wrapping commit can be
      // rolled back rather than silently committing only the message row.
      throw err;
    }
  }

  async listRuns(userId: string, agentId: string): Promise<BenchmarkHistoryRunSummary[]> {
    const tenantId = await this.tenantCache.resolve(userId);
    const qb = this.runRepo
      .createQueryBuilder('r')
      .where('r.agent_id = :agentId', { agentId })
      .orderBy('r.created_at', 'DESC')
      .take(MAX_RUNS_PER_AGENT);
    this.applyOwnership(qb, userId, tenantId);
    const runs = await qb.getMany();
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
      };
    });
  }

  async getRun(userId: string, runId: string): Promise<BenchmarkHistoryRunDetail> {
    const tenantId = await this.tenantCache.resolve(userId);
    const qb = this.runRepo.createQueryBuilder('r').where('r.id = :runId', { runId });
    this.applyOwnership(qb, userId, tenantId);
    const run = await qb.getOne();
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
                // numericTransformer on the entity already returns a number/null —
                // no further coercion needed here.
                cost: c.cost_usd ?? null,
                durationMs: c.duration_ms!,
              }
            : null,
          position: c.position,
        };
      }),
    };
  }

  private async pruneOldRuns(userId: string, agentId: string): Promise<void> {
    // Hard cap on the prune fetch so a long-skipped prune doesn't suddenly
    // pull a massive list into memory. 500 surplus rows per call is far above
    // anything we'd see in steady state.
    const tenantId = await this.tenantCache.resolve(userId);
    const qb = this.runRepo
      .createQueryBuilder('r')
      .select('r.id', 'id')
      .where('r.agent_id = :agentId', { agentId })
      .orderBy('r.created_at', 'DESC')
      .offset(MAX_RUNS_PER_AGENT)
      .limit(PRUNE_BATCH_LIMIT);
    this.applyOwnership(qb, userId, tenantId);
    const surplus = await qb.getRawMany<{ id: string }>();
    if (surplus.length === 0) return;
    await this.runRepo.delete({ id: In(surplus.map((s) => s.id)) });
  }
}
