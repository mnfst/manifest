import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { TokenUsageSnapshot } from '../../entities/token-usage-snapshot.entity';
import { CostSnapshot } from '../../entities/cost-snapshot.entity';
import { OtlpExportMetricsServiceRequest, OtlpNumberDataPoint } from '../interfaces';
import { IngestionContext } from '../interfaces/ingestion-context.interface';
import { extractAttributes, nanoToDatetime, getNumericValue, attrString } from './otlp-helpers';

const TOKEN_METRIC_NAMES = new Set([
  'gen_ai.usage.input_tokens',
  'gen_ai.usage.output_tokens',
  'gen_ai.usage.total_tokens',
  'gen_ai.usage.cache_read_tokens',
  'gen_ai.usage.cache_creation_tokens',
]);

const COST_METRIC_NAMES = new Set([
  'gen_ai.usage.cost',
  'gen_ai.cost.usd',
]);

@Injectable()
export class MetricIngestService {
  constructor(
    @InjectRepository(TokenUsageSnapshot)
    private readonly tokenRepo: Repository<TokenUsageSnapshot>,
    @InjectRepository(CostSnapshot)
    private readonly costRepo: Repository<CostSnapshot>,
  ) {}

  async ingest(
    request: OtlpExportMetricsServiceRequest,
    ctx: IngestionContext,
  ): Promise<{ accepted: number }> {
    let accepted = 0;

    for (const rm of request.resourceMetrics ?? []) {
      const resourceAttrs = extractAttributes(rm.resource?.attributes);
      const agentName = attrString(resourceAttrs, 'agent.name') ?? attrString(resourceAttrs, 'service.name');

      for (const sm of rm.scopeMetrics ?? []) {
        for (const metric of sm.metrics ?? []) {
          const dataPoints = metric.gauge?.dataPoints ?? metric.sum?.dataPoints ?? [];

          if (TOKEN_METRIC_NAMES.has(metric.name)) {
            await this.insertTokenSnapshots(metric.name, dataPoints, agentName, ctx);
            accepted += dataPoints.length;
          } else if (COST_METRIC_NAMES.has(metric.name)) {
            await this.insertCostSnapshots(dataPoints, agentName, ctx);
            accepted += dataPoints.length;
          }
        }
      }
    }

    return { accepted };
  }

  private async insertTokenSnapshots(
    metricName: string,
    points: OtlpNumberDataPoint[],
    agentName: string | null,
    ctx: IngestionContext,
  ): Promise<void> {
    for (const pt of points) {
      const pointAttrs = extractAttributes(pt.attributes);
      const agent = attrString(pointAttrs, 'agent.name') ?? agentName;
      const value = getNumericValue(pt);
      const ts = nanoToDatetime(pt.timeUnixNano);

      const fields = this.mapTokenField(metricName, value);
      await this.tokenRepo.insert({
        id: uuidv4(),
        tenant_id: ctx.tenantId,
        agent_id: ctx.agentId,
        agent_name: agent,
        snapshot_time: ts,
        input_tokens: fields.input,
        output_tokens: fields.output,
        cache_read_tokens: fields.cacheRead,
        cache_creation_tokens: fields.cacheCreate,
        total_tokens: fields.total,
      });
    }
  }

  private mapTokenField(name: string, value: number) {
    const base = { input: 0, output: 0, cacheRead: 0, cacheCreate: 0, total: 0 };
    if (name.endsWith('input_tokens')) base.input = value;
    else if (name.endsWith('output_tokens')) base.output = value;
    else if (name.endsWith('cache_read_tokens')) base.cacheRead = value;
    else if (name.endsWith('cache_creation_tokens')) base.cacheCreate = value;
    else if (name.endsWith('total_tokens')) base.total = value;
    return base;
  }

  private async insertCostSnapshots(
    points: OtlpNumberDataPoint[],
    agentName: string | null,
    ctx: IngestionContext,
  ): Promise<void> {
    for (const pt of points) {
      const pointAttrs = extractAttributes(pt.attributes);
      const agent = attrString(pointAttrs, 'agent.name') ?? agentName;
      const model = attrString(pointAttrs, 'gen_ai.request.model');

      await this.costRepo.insert({
        id: uuidv4(),
        tenant_id: ctx.tenantId,
        agent_id: ctx.agentId,
        agent_name: agent,
        snapshot_time: nanoToDatetime(pt.timeUnixNano),
        cost_usd: getNumericValue(pt),
        model,
      });
    }
  }
}
