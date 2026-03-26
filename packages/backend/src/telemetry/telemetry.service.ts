import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { AgentMessage } from '../entities/agent-message.entity';
import { TelemetryEventDto } from './dto/create-telemetry.dto';
import { IngestEventBusService } from '../common/services/ingest-event-bus.service';
import { TenantCacheService } from '../common/services/tenant-cache.service';
import { ModelPricingCacheService } from '../model-prices/model-pricing-cache.service';

export interface IngestResult {
  accepted: number;
  rejected: number;
  errors: Array<{ index: number; reason: string }>;
}

@Injectable()
export class TelemetryService {
  private readonly logger = new Logger(TelemetryService.name);

  constructor(
    @InjectRepository(AgentMessage)
    private readonly turnRepo: Repository<AgentMessage>,
    private readonly eventBus: IngestEventBusService,
    private readonly tenantCache: TenantCacheService,
    private readonly pricingCache: ModelPricingCacheService,
  ) {}

  private static readonly MAX_EVENTS_PER_BATCH = 1000;

  async ingest(events: TelemetryEventDto[], userId: string): Promise<IngestResult> {
    if (!Array.isArray(events)) {
      return { accepted: 0, rejected: 0, errors: [] };
    }
    const tenantId = await this.tenantCache.resolve(userId);
    const maxLen = Math.min(events.length, TelemetryService.MAX_EVENTS_PER_BATCH);
    const messageRows: Record<string, unknown>[] = [];
    const errors: Array<{ index: number; reason: string }> = [];

    for (let i = 0; i < maxLen; i++) {
      try {
        const message = this.buildMessageRow(events[i], userId, tenantId);
        messageRows.push(message);
      } catch (err) {
        const reason = err instanceof Error ? err.message : 'Insert failed';
        errors.push({ index: i, reason });
        this.logger.warn(`Event ${i} rejected: ${reason}`);
      }
    }

    let accepted = messageRows.length;
    let rejected = errors.length;

    try {
      if (messageRows.length > 0) await this.turnRepo.insert(messageRows);
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Insert failed';
      this.logger.warn(`Batch insert failed: ${reason}`);
      rejected += accepted;
      errors.push({ index: 0, reason });
      accepted = 0;
    }
    if (accepted > 0) {
      this.eventBus.emit(userId);
    }

    this.logger.log(`Ingested ${accepted} events, rejected ${rejected}`);
    return { accepted, rejected, errors };
  }

  private normalizeTimestamp(ts: string): string {
    return new Date(ts).toISOString();
  }

  private buildMessageRow(
    event: TelemetryEventDto,
    userId: string,
    tenantId: string | null,
  ): Record<string, unknown> {
    const inputTok = event.input_tokens ?? 0;
    const outputTok = event.output_tokens ?? 0;
    const timestamp = this.normalizeTimestamp(event.timestamp);

    let costUsd: number | null = null;
    if (event.model) {
      const pricing = this.pricingCache.getByModel(event.model);
      if (
        pricing &&
        pricing.input_price_per_token != null &&
        pricing.output_price_per_token != null
      ) {
        costUsd =
          inputTok * Number(pricing.input_price_per_token) +
          outputTok * Number(pricing.output_price_per_token);
      }
    }

    return {
      id: uuidv4(),
      timestamp,
      description: event.description,
      service_type: event.service_type,
      agent_name: event.agent_name ?? null,
      status: event.status,
      model: event.model ?? null,
      input_tokens: inputTok,
      output_tokens: outputTok,
      skill_name: event.skill_name ?? null,
      cost_usd: costUsd,
      tenant_id: tenantId,
      user_id: userId,
    };
  }
}
