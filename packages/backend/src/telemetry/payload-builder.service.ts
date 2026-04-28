import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PROVIDER_BY_ID_OR_ALIAS } from '../common/constants/providers';
import { Agent } from '../entities/agent.entity';
import { AgentMessage } from '../entities/agent-message.entity';
import type { TelemetryPayloadV1 } from './dto/telemetry-payload';
import { TELEMETRY_SCHEMA_VERSION } from './telemetry.config';

interface ProviderAggregateRow {
  provider: string | null;
  count: string;
}

interface BucketRow {
  bucket: string | null;
  count: string;
}

interface TotalsRow {
  total: string;
  input_tokens: string | null;
  output_tokens: string | null;
}

/**
 * Builds the daily telemetry payload by aggregating the last 24h of
 * `agent_messages` plus the total agent count + runtime metadata. All
 * SELECTs are parameterised so the window is consistent across queries.
 */
@Injectable()
export class PayloadBuilderService {
  constructor(
    @InjectRepository(AgentMessage)
    private readonly messages: Repository<AgentMessage>,
    @InjectRepository(Agent)
    private readonly agents: Repository<Agent>,
  ) {}

  async build(installId: string, manifestVersion: string): Promise<TelemetryPayloadV1> {
    const [providerRows, tierRows, authRows, totals, agentsTotal, agentPlatformRows] =
      await Promise.all([
        this.messagesByProvider(),
        this.messagesByBucket('routing_tier'),
        this.messagesByBucket('auth_type'),
        this.totals(),
        this.agents.count(),
        this.agentsByPlatform(),
      ]);

    return {
      schema_version: TELEMETRY_SCHEMA_VERSION,
      install_id: installId,
      manifest_version: manifestVersion,
      messages_total: Number(totals.total),
      messages_by_provider: this.collapseProviders(providerRows),
      messages_by_tier: this.bucketsToRecord(tierRows, 'unknown'),
      messages_by_auth_type: this.bucketsToRecord(authRows, 'unknown'),
      tokens_input_total: Number(totals.input_tokens ?? 0),
      tokens_output_total: Number(totals.output_tokens ?? 0),
      agents_total: agentsTotal,
      agents_by_platform: this.bucketsToRecord(agentPlatformRows, 'unknown'),
      platform: process.platform,
      arch: process.arch,
    };
  }

  private async messagesByProvider(): Promise<ProviderAggregateRow[]> {
    return this.messages
      .createQueryBuilder('m')
      .select('m.provider', 'provider')
      .addSelect('COUNT(*)', 'count')
      .where(`m.timestamp >= NOW() - INTERVAL '24 hours'`)
      .groupBy('m.provider')
      .getRawMany<ProviderAggregateRow>();
  }

  /**
   * Groups the 24h-window messages by any column whose values are already a
   * short stable set (`routing_tier`, `auth_type`). We trust the set because
   * the producer — our own proxy — writes known enum strings.
   */
  private async messagesByBucket(column: 'routing_tier' | 'auth_type'): Promise<BucketRow[]> {
    return this.messages
      .createQueryBuilder('m')
      .select(`m.${column}`, 'bucket')
      .addSelect('COUNT(*)', 'count')
      .where(`m.timestamp >= NOW() - INTERVAL '24 hours'`)
      .groupBy(`m.${column}`)
      .getRawMany<BucketRow>();
  }

  private async agentsByPlatform(): Promise<BucketRow[]> {
    return this.agents
      .createQueryBuilder('a')
      .select('a.agent_platform', 'bucket')
      .addSelect('COUNT(*)', 'count')
      .groupBy('a.agent_platform')
      .getRawMany<BucketRow>();
  }

  private async totals(): Promise<TotalsRow> {
    const row = await this.messages
      .createQueryBuilder('m')
      .select('COUNT(*)', 'total')
      .addSelect('SUM(m.input_tokens)', 'input_tokens')
      .addSelect('SUM(m.output_tokens)', 'output_tokens')
      .where(`m.timestamp >= NOW() - INTERVAL '24 hours'`)
      .getRawOne<TotalsRow>();
    return row ?? { total: '0', input_tokens: '0', output_tokens: '0' };
  }

  /**
   * Maps each raw `provider` value to either its canonical registry ID or
   * the bucket `"custom"` (for user-defined providers) / `"unknown"` (for
   * pre-provider-column rows). Prevents custom provider names — which may
   * leak URLs or user configuration — from escaping the box.
   */
  private collapseProviders(rows: ProviderAggregateRow[]): Record<string, number> {
    const out: Record<string, number> = {};
    for (const row of rows) {
      const bucket = this.bucketFor(row.provider);
      out[bucket] = (out[bucket] ?? 0) + Number(row.count);
    }
    return out;
  }

  private bucketFor(provider: string | null): string {
    if (!provider) return 'unknown';
    const entry = PROVIDER_BY_ID_OR_ALIAS.get(provider.toLowerCase());
    return entry ? entry.id : 'custom';
  }

  private bucketsToRecord(rows: BucketRow[], nullLabel: string): Record<string, number> {
    const out: Record<string, number> = {};
    for (const row of rows) {
      const key = row.bucket ?? nullLabel;
      out[key] = (out[key] ?? 0) + Number(row.count);
    }
    return out;
  }
}
