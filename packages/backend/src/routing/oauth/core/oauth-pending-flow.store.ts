import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';

export interface OAuthPendingFlowInput {
  state: string;
  verifier: string;
  agentId: string;
  userId: string;
}

export interface OAuthPendingFlowRecord extends OAuthPendingFlowInput {
  provider: string;
  expiresAt: number;
}

interface RawOAuthPendingFlow {
  provider: string;
  state: string;
  code_verifier: string;
  agent_id: string;
  user_id: string;
  expires_at: Date | string;
}

@Injectable()
export class OAuthPendingFlowStore {
  private readonly logger = new Logger(OAuthPendingFlowStore.name);

  constructor(private readonly dataSource: DataSource) {}

  async create(
    provider: string,
    input: OAuthPendingFlowInput,
    ttlMs: number,
  ): Promise<OAuthPendingFlowRecord> {
    const expiresAt = new Date(Date.now() + ttlMs);

    await this.cleanupExpired(provider);
    await this.dataSource.query(
      `
        DELETE FROM "oauth_pending_flows"
        WHERE "provider" = $1
          AND "agent_id" = $2
          AND "user_id" = $3
      `,
      [provider, input.agentId, input.userId],
    );
    await this.dataSource.query(
      `
        INSERT INTO "oauth_pending_flows"
          ("provider", "state", "code_verifier", "agent_id", "user_id", "expires_at")
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [provider, input.state, input.verifier, input.agentId, input.userId, expiresAt],
    );

    return { provider, ...input, expiresAt: expiresAt.getTime() };
  }

  async consume(
    provider: string,
    state: string,
    agentId: string,
    userId: string,
  ): Promise<OAuthPendingFlowRecord | null> {
    const result = await this.dataSource.query(
      `
        DELETE FROM "oauth_pending_flows"
        WHERE "provider" = $1
          AND "state" = $2
          AND "agent_id" = $3
          AND "user_id" = $4
          AND "expires_at" > NOW()
        RETURNING "provider", "state", "code_verifier", "agent_id", "user_id", "expires_at"
      `,
      [provider, state, agentId, userId],
    );
    const rows = queryRows<RawOAuthPendingFlow>(result);

    return rows[0] ? mapRow(rows[0]) : null;
  }

  async findLatestForAgent(
    provider: string,
    agentId: string,
    userId: string,
  ): Promise<OAuthPendingFlowRecord | null> {
    await this.cleanupExpired(provider);
    const rows = (await this.dataSource.query(
      `
        SELECT "provider", "state", "code_verifier", "agent_id", "user_id", "expires_at"
        FROM "oauth_pending_flows"
        WHERE "provider" = $1
          AND "agent_id" = $2
          AND "user_id" = $3
          AND "expires_at" > NOW()
        ORDER BY "created_at" DESC
        LIMIT 1
      `,
      [provider, agentId, userId],
    )) as RawOAuthPendingFlow[];

    return rows[0] ? mapRow(rows[0]) : null;
  }

  async clear(provider: string, state: string): Promise<void> {
    await this.dataSource.query(
      `
        DELETE FROM "oauth_pending_flows"
        WHERE "provider" = $1
          AND "state" = $2
      `,
      [provider, state],
    );
  }

  async count(provider: string): Promise<number> {
    await this.cleanupExpired(provider);
    const rows = (await this.dataSource.query(
      `
        SELECT COUNT(*)::int AS "count"
        FROM "oauth_pending_flows"
        WHERE "provider" = $1
      `,
      [provider],
    )) as Array<{ count: number | string }>;
    return Number(rows[0]?.count ?? 0);
  }

  async cleanupExpired(provider?: string): Promise<void> {
    if (provider) {
      await this.dataSource.query(
        `
          DELETE FROM "oauth_pending_flows"
          WHERE "provider" = $1
            AND "expires_at" <= NOW()
        `,
        [provider],
      );
      return;
    }

    await this.dataSource.query(
      `
        DELETE FROM "oauth_pending_flows"
        WHERE "expires_at" <= NOW()
      `,
    );
  }

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredCron(): Promise<void> {
    try {
      await this.cleanupExpired();
    } catch (err) {
      this.logger.warn(`Failed to clean expired OAuth pending flows: ${err}`);
    }
  }
}

function mapRow(row: RawOAuthPendingFlow): OAuthPendingFlowRecord {
  const expiresAt =
    row.expires_at instanceof Date ? row.expires_at.getTime() : new Date(row.expires_at).getTime();
  return {
    provider: row.provider,
    state: row.state,
    verifier: row.code_verifier,
    agentId: row.agent_id,
    userId: row.user_id,
    expiresAt,
  };
}

function queryRows<T>(result: unknown): T[] {
  if (
    Array.isArray(result) &&
    result.length === 2 &&
    Array.isArray(result[0]) &&
    typeof result[1] === 'number'
  ) {
    return result[0] as T[];
  }
  return result as T[];
}
