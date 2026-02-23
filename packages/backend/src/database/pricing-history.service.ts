import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { ModelPricingHistory } from '../entities/model-pricing-history.entity';
import { ModelPricing } from '../entities/model-pricing.entity';
import { sqlNow } from '../common/utils/sql-dialect';

interface IncomingPricing {
  model_name: string;
  input_price_per_token: number;
  output_price_per_token: number;
  provider: string;
}

@Injectable()
export class PricingHistoryService {
  constructor(
    @InjectRepository(ModelPricingHistory)
    private readonly historyRepo: Repository<ModelPricingHistory>,
  ) {}

  async recordChange(
    existing: ModelPricing | null,
    incoming: IncomingPricing,
    source: string,
  ): Promise<boolean> {
    const now = new Date(sqlNow());

    if (!existing) {
      await this.insertHistoryEntry(incoming, now, source);
      return true;
    }

    if (!this.hasPriceChanged(existing, incoming)) {
      return false;
    }

    await this.closeCurrentEntry(existing.model_name, now);
    await this.insertHistoryEntry(incoming, now, source);
    return true;
  }

  private hasPriceChanged(
    existing: ModelPricing,
    incoming: IncomingPricing,
  ): boolean {
    const oldInput = Number(existing.input_price_per_token);
    const oldOutput = Number(existing.output_price_per_token);
    return (
      oldInput !== incoming.input_price_per_token ||
      oldOutput !== incoming.output_price_per_token
    );
  }

  private async closeCurrentEntry(
    modelName: string,
    until: Date,
  ): Promise<void> {
    await this.historyRepo.update(
      { model_name: modelName, effective_until: IsNull() },
      { effective_until: until },
    );
  }

  private async insertHistoryEntry(
    incoming: IncomingPricing,
    effectiveFrom: Date,
    source: string,
  ): Promise<void> {
    const entry = this.historyRepo.create({
      id: randomUUID(),
      model_name: incoming.model_name,
      input_price_per_token: incoming.input_price_per_token,
      output_price_per_token: incoming.output_price_per_token,
      provider: incoming.provider,
      effective_from: effectiveFrom,
      effective_until: null,
      change_source: source,
    });
    await this.historyRepo.save(entry);
  }

  async getHistory(modelName: string): Promise<ModelPricingHistory[]> {
    return this.historyRepo.find({
      where: { model_name: modelName },
      order: { effective_from: 'DESC' },
    });
  }
}
