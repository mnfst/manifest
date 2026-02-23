import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { UnresolvedModelTrackerService } from './unresolved-model-tracker.service';
import { PricingHistoryService } from '../database/pricing-history.service';
import { PricingSyncService } from '../database/pricing-sync.service';

interface ModelPriceRow {
  model_name: string;
  provider: string;
  input_price_per_token: number;
  output_price_per_token: number;
  updated_at: string | null;
}

@Injectable()
export class ModelPricesService {
  constructor(
    private readonly ds: DataSource,
    private readonly unresolvedTracker: UnresolvedModelTrackerService,
    private readonly pricingHistory: PricingHistoryService,
    private readonly pricingSync: PricingSyncService,
  ) {}

  async getAll() {
    const rows: ModelPriceRow[] = await this.ds.query(
      `SELECT model_name, provider, input_price_per_token, output_price_per_token, updated_at
       FROM model_pricing
       ORDER BY provider, model_name`,
    );

    const lastSyncRow = await this.ds.query(
      `SELECT MIN(updated_at) as last_synced FROM model_pricing WHERE updated_at IS NOT NULL`,
    );
    const lastSyncedAt: string | null = lastSyncRow[0]?.last_synced ?? null;

    return {
      models: rows.map((r) => ({
        model_name: r.model_name,
        provider: r.provider || 'Unknown',
        input_price_per_million: Number(r.input_price_per_token) * 1_000_000,
        output_price_per_million: Number(r.output_price_per_token) * 1_000_000,
      })),
      lastSyncedAt,
    };
  }

  async triggerSync() {
    const updated = await this.pricingSync.syncPricing();
    return { updated };
  }

  async getUnresolved() {
    return this.unresolvedTracker.getUnresolved();
  }

  async getHistory(modelName: string) {
    const records = await this.pricingHistory.getHistory(modelName);
    return records.map((r) => ({
      ...r,
      input_price_per_million: Number(r.input_price_per_token) * 1_000_000,
      output_price_per_million: Number(r.output_price_per_token) * 1_000_000,
    }));
  }
}
