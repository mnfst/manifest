import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { AgentMessage } from '../entities/agent-message.entity';
import { SecurityEvent } from '../entities/security-event.entity';
import { TelemetryEventDto } from './dto/create-telemetry.dto';
import { IngestEventBusService } from '../common/services/ingest-event-bus.service';
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
    @InjectRepository(SecurityEvent)
    private readonly securityRepo: Repository<SecurityEvent>,
    private readonly eventBus: IngestEventBusService,
    private readonly pricingCache: ModelPricingCacheService,
  ) {}

  private static readonly MAX_EVENTS_PER_BATCH = 1000;

  async ingest(events: TelemetryEventDto[], userId: string): Promise<IngestResult> {
    if (!Array.isArray(events)) {
      return { accepted: 0, rejected: 0, errors: [] };
    }
    const maxLen = Math.min(events.length, TelemetryService.MAX_EVENTS_PER_BATCH);
    let accepted = 0;
    let rejected = 0;
    const errors: Array<{ index: number; reason: string }> = [];

    for (let i = 0; i < maxLen; i++) {
      try {
        await this.insertEvent(events[i], userId);
        accepted++;
      } catch (err) {
        rejected++;
        const reason = err instanceof Error ? err.message : 'Insert failed';
        errors.push({ index: i, reason });
        this.logger.warn(`Event ${i} rejected: ${reason}`);
      }
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

  private async insertEvent(event: TelemetryEventDto, userId: string): Promise<void> {
    const id = uuidv4();
    const inputTok = event.input_tokens ?? 0;
    const outputTok = event.output_tokens ?? 0;
    const timestamp = this.normalizeTimestamp(event.timestamp);

    let costUsd: number | null = null;
    if (event.model) {
      const pricing = this.pricingCache.getByModel(event.model);
      if (pricing) {
        costUsd = inputTok * Number(pricing.input_price_per_token) + outputTok * Number(pricing.output_price_per_token);
      }
    }

    await this.turnRepo.insert({
      id,
      timestamp: timestamp,
      description: event.description,
      service_type: event.service_type,
      agent_name: event.agent_name ?? null,
      status: event.status,
      model: event.model ?? null,
      input_tokens: inputTok,
      output_tokens: outputTok,
      skill_name: event.skill_name ?? null,
      cost_usd: costUsd,
      user_id: userId,
    });

    if (event.security_event) {
      await this.securityRepo.insert({
        id: uuidv4(),
        timestamp: timestamp,
        severity: event.security_event.severity,
        category: event.security_event.category,
        description: event.security_event.description,
        user_id: userId,
      });
    }
  }
}
