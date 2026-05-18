import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';
import type {
  AuthType,
  PlaygroundHistoryColumn,
  PlaygroundHistoryRunDetail,
  PlaygroundHistoryRunSummary,
} from 'manifest-shared';
import { PlaygroundRun } from '../entities/playground-run.entity';
import { PlaygroundColumn } from '../entities/playground-column.entity';

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
export class PlaygroundHistoryService {
  private readonly logger = new Logger(PlaygroundHistoryService.name);

  constructor(
    @InjectRepository(PlaygroundRun)
    private readonly runRepo: Repository<PlaygroundRun>,
    @InjectRepository(PlaygroundColumn)
    private readonly columnRepo: Repository<PlaygroundColumn>,
  ) {}

  async saveColumn(input: SaveColumnInput): Promise<string | null> {
    const runId = input.runId ?? uuid();
    const columnId = uuid();

    const insertedRun = await this.ensureRun(runId, input);

    try {
      await this.columnRepo.insert({
        id: columnId,
        playground_run_id: runId,
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
        `Failed to persist playground history column: ${err instanceof Error ? err.message : err}`,
      );
      // The column was not persisted — return null so callers don't hand the
      // client a columnId that references a row that does not exist.
      return null;
    }

    if (insertedRun) {
      try {
        await this.pruneOldRuns(input.userId, input.agent.id);
      } catch (err) {
        this.logger.warn(
          `Failed to prune old playground runs: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    return columnId;
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
        .into('playground_runs')
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
        `Failed to ensure playground run row: ${err instanceof Error ? err.message : err}`,
      );
      return false;
    }
  }

  async listRuns(userId: string, agentId: string): Promise<PlaygroundHistoryRunSummary[]> {
    const runs = await this.runRepo.find({
      where: { user_id: userId, agent_id: agentId },
      order: { created_at: 'DESC' },
      take: MAX_RUNS_PER_AGENT,
    });
    if (runs.length === 0) return [];

    const columns = await this.columnRepo.find({
      where: { playground_run_id: In(runs.map((r) => r.id)) },
      select: ['playground_run_id', 'model', 'display_name', 'position'],
      order: { position: 'ASC' },
    });

    const modelsByRun = new Map<string, string[]>();
    for (const c of columns) {
      const bucket = modelsByRun.get(c.playground_run_id) ?? [];
      bucket.push(c.display_name ?? c.model);
      modelsByRun.set(c.playground_run_id, bucket);
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
        bestColumnId: r.best_column_id ?? null,
      };
    });
  }

  async getRun(
    userId: string,
    runId: string,
    agentId?: string,
  ): Promise<PlaygroundHistoryRunDetail> {
    const where: { id: string; user_id: string; agent_id?: string } = {
      id: runId,
      user_id: userId,
    };
    if (agentId) where.agent_id = agentId;
    const run = await this.runRepo.findOne({ where });
    if (!run) throw new NotFoundException(`Playground run "${runId}" not found`);

    const columns = await this.columnRepo.find({
      where: { playground_run_id: runId },
      order: { position: 'ASC' },
    });

    return {
      id: run.id,
      prompt: run.prompt,
      createdAt: run.created_at,
      modelCount: columns.length,
      models: columns.map((c) => c.display_name ?? c.model),
      starred: run.starred,
      bestColumnId: run.best_column_id ?? null,
      columns: columns.map((c): PlaygroundHistoryColumn => {
        const hasMetrics =
          c.status === 'success' &&
          c.input_tokens != null &&
          c.output_tokens != null &&
          c.duration_ms != null;
        return {
          id: c.id,
          model: c.model,
          provider: c.provider,
          authType: (c.auth_type ?? null) as PlaygroundHistoryColumn['authType'],
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
      .update(PlaygroundRun)
      .set({ starred: () => 'NOT starred' })
      .where('id = :runId AND user_id = :userId', { runId, userId })
      .returning('starred')
      .execute();

    if (result.affected === 0) {
      throw new NotFoundException(`Playground run "${runId}" not found`);
    }

    return result.raw[0].starred;
  }

  /**
   * Sets (or clears, when columnId is null) the user's "best answer" pick for
   * a run. Single-select per run — this is the reinforcement-learning
   * preference label, so a run has exactly zero or one best column.
   *
   * When setting, the column must belong to this run: a cross-run id would
   * poison the RL signal. The ownership update is a single atomic statement
   * scoped by user_id (same pattern as toggleStar).
   */
  async setBestColumn(
    userId: string,
    runId: string,
    columnId: string | null,
  ): Promise<string | null> {
    if (columnId !== null) {
      const column = await this.columnRepo.findOne({
        where: { id: columnId, playground_run_id: runId },
        select: ['id'],
      });
      if (!column) {
        throw new NotFoundException(
          `Column "${columnId}" does not belong to playground run "${runId}"`,
        );
      }
    }

    const result = await this.runRepo
      .createQueryBuilder()
      .update(PlaygroundRun)
      .set({ best_column_id: columnId })
      .where('id = :runId AND user_id = :userId', { runId, userId })
      .returning('best_column_id')
      .execute();

    if (result.affected === 0) {
      throw new NotFoundException(`Playground run "${runId}" not found`);
    }

    return result.raw[0].best_column_id ?? null;
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
