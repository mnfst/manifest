import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

interface ModelPriceRow {
  model_name: string;
  provider: string;
  input_price_per_token: number;
  output_price_per_token: number;
  updated_at: string | null;
  capability_vision: boolean;
  capability_tool_calling: boolean;
  capability_reasoning: boolean;
  capability_structured_output: boolean;
}

@Injectable()
export class ModelPricesService {
  constructor(private readonly ds: DataSource) {}

  async getAll() {
    const rows: ModelPriceRow[] = await this.ds.query(
      `SELECT model_name, provider, input_price_per_token, output_price_per_token, updated_at,
              capability_vision, capability_tool_calling, capability_reasoning, capability_structured_output
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
        capability_vision: !!r.capability_vision,
        capability_tool_calling: !!r.capability_tool_calling,
        capability_reasoning: !!r.capability_reasoning,
        capability_structured_output: !!r.capability_structured_output,
      })),
      lastSyncedAt,
    };
  }
}
