import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  compareProviderParamSpecs,
  getProviderParamSpecs,
  isParamApplicability,
  type AuthType,
  type JsonValue,
  type ModelParamGroup,
  type ModelParamRange,
  type ModelParamType,
  type ParamApplicability,
  type ProviderParamSpec,
  type ProviderParamSpecCatalog,
} from 'manifest-shared';
import { ProviderParamSpecEntity } from '../../entities/provider-param-spec.entity';

const CACHE_TTL_MS = 120_000;

@Injectable()
export class ProviderParamSpecService {
  private cache: { specs: ProviderParamSpecCatalog; expiresAt: number } | null = null;

  constructor(
    @InjectRepository(ProviderParamSpecEntity)
    private readonly repo: Repository<ProviderParamSpecEntity>,
  ) {}

  async list(): Promise<ProviderParamSpecCatalog> {
    if (this.cache && this.cache.expiresAt > Date.now()) return this.cache.specs;

    const rows = await this.repo.find({
      order: {
        provider: 'ASC',
        auth_type: 'ASC',
        model_name: 'ASC',
        param_group: 'ASC',
        param_path: 'ASC',
      },
    });
    const specs = rows.map((row) => this.rowToSpec(row)).sort(compareProviderParamSpecs);
    this.cache = { specs, expiresAt: Date.now() + CACHE_TTL_MS };
    return specs;
  }

  async getSpecs(
    providerId: string | undefined,
    authType: AuthType | undefined,
    model: string | undefined,
  ): Promise<readonly ProviderParamSpec[]> {
    return getProviderParamSpecs(await this.list(), providerId, authType, model);
  }

  private rowToSpec(row: ProviderParamSpecEntity): ProviderParamSpec {
    const spec: ProviderParamSpec = {
      provider: row.provider,
      authType: row.auth_type,
      model: row.model_name,
      path: row.param_path,
      type: this.assertType(row),
      label: row.label,
      default: row.default_value,
      group: this.assertGroup(row),
    };

    if (row.values !== null) spec.values = this.assertValues(row);
    if (row.range !== null) spec.range = this.assertRange(row);
    if (row.applicability !== null) spec.applicability = this.assertApplicability(row);
    return spec;
  }

  private assertType(row: ProviderParamSpecEntity): ModelParamType {
    const value = row.param_type;
    if (
      value === 'boolean' ||
      value === 'enum' ||
      value === 'integer' ||
      value === 'number' ||
      value === 'string'
    ) {
      return value;
    }
    throw new Error(`Invalid provider param type: ${row.id}`);
  }

  private assertGroup(row: ProviderParamSpecEntity): ModelParamGroup {
    const value = row.param_group;
    if (
      value === 'generation_length' ||
      value === 'sampling' ||
      value === 'reasoning' ||
      value === 'tooling' ||
      value === 'output_format' ||
      value === 'observability' ||
      value === 'provider_metadata'
    ) {
      return value;
    }
    throw new Error(`Invalid provider param group: ${row.id}`);
  }

  private assertValues(row: ProviderParamSpecEntity): JsonValue[] {
    if (!Array.isArray(row.values)) throw new Error(`Invalid provider param values: ${row.id}`);
    return row.values;
  }

  private assertRange(row: ProviderParamSpecEntity): ModelParamRange {
    if (!isRecord(row.range)) throw new Error(`Invalid provider param range: ${row.id}`);
    const range: ModelParamRange = {};
    if (row.range.min !== undefined) {
      if (typeof row.range.min !== 'number')
        throw new Error(`Invalid provider param min: ${row.id}`);
      range.min = row.range.min;
    }
    if (row.range.max !== undefined) {
      if (typeof row.range.max !== 'number')
        throw new Error(`Invalid provider param max: ${row.id}`);
      range.max = row.range.max;
    }
    if (row.range.step !== undefined) {
      if (typeof row.range.step !== 'number') {
        throw new Error(`Invalid provider param step: ${row.id}`);
      }
      range.step = row.range.step;
    }
    return range;
  }

  private assertApplicability(row: ProviderParamSpecEntity): ParamApplicability {
    const value = row.applicability;
    if (!isParamApplicability(value)) {
      throw new Error(`Invalid provider param applicability: ${row.id}`);
    }
    return value;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
