import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  getProviderParamSpecs,
  type AuthType,
  type JsonValue,
  type ParamControl,
  type ProviderParamDependency,
  type ProviderParamSpec,
  type ProviderParamSpecGroup,
  type ProviderParamSpecRegistry,
} from 'manifest-shared';
import { ProviderParamSpecEntity } from '../../entities/provider-param-spec.entity';

const CACHE_TTL_MS = 120_000;

type Serializer = (value: JsonValue) => Record<string, JsonValue>;

const SERIALIZERS: Record<string, Serializer> = {
  anthropic_thinking: serializeAnthropicThinking,
};

@Injectable()
export class ProviderParamSpecService {
  private cache: { registry: ProviderParamSpecRegistry; expiresAt: number } | null = null;

  constructor(
    @InjectRepository(ProviderParamSpecEntity)
    private readonly repo: Repository<ProviderParamSpecEntity>,
  ) {}

  async getRegistry(): Promise<ProviderParamSpecRegistry> {
    if (this.cache && this.cache.expiresAt > Date.now()) return this.cache.registry;

    const rows = await this.repo.find({
      order: {
        provider: 'ASC',
        auth_type: 'ASC',
        model_name: 'ASC',
        sort_order: 'ASC',
        param_key: 'ASC',
      },
    });
    const registry = this.rowsToRegistry(rows);
    this.cache = { registry, expiresAt: Date.now() + CACHE_TTL_MS };
    return registry;
  }

  async getSpecs(
    providerId: string | undefined,
    authType: AuthType | undefined,
    model?: string | undefined,
  ): Promise<readonly ProviderParamSpec[]> {
    return getProviderParamSpecs(await this.getRegistry(), providerId, authType, model);
  }

  private rowsToRegistry(rows: ProviderParamSpecEntity[]): ProviderParamSpecRegistry {
    const registry: Record<string, ProviderParamSpecGroup> = {};

    for (const row of rows) {
      const groupKey = `${row.provider.toLowerCase()}:${row.auth_type}` as `${string}:${AuthType}`;
      const existing = registry[groupKey];
      const group: {
        base: ProviderParamSpec[];
        byModel?: Record<string, ProviderParamSpec[]>;
      } = existing
        ? {
            base: [...existing.base],
            byModel: existing.byModel
              ? Object.fromEntries(
                  Object.entries(existing.byModel).map(([model, specs]) => [model, [...specs]]),
                )
              : undefined,
          }
        : { base: [] };

      const spec = this.rowToSpec(row);
      if (row.model_name) {
        group.byModel ??= {};
        group.byModel[row.model_name] ??= [];
        group.byModel[row.model_name].push(spec);
      } else {
        group.base.push(spec);
      }
      registry[groupKey] = group;
    }

    return registry as ProviderParamSpecRegistry;
  }

  private rowToSpec(row: ProviderParamSpecEntity): ProviderParamSpec {
    const spec: ProviderParamSpec = {
      key: row.param_key,
      control: this.rowToControl(row),
    };

    if (row.serializer) {
      const serialize = SERIALIZERS[row.serializer];
      if (!serialize) throw new Error(`Unknown provider param serializer: ${row.serializer}`);
      if (row.group_key) {
        spec.group = {
          key: row.group_key,
          label: row.group_label ?? row.group_key,
          serialize,
        };
      } else {
        spec.serialize = serialize;
      }
    } else if (row.group_key) {
      spec.group = {
        key: row.group_key,
        label: row.group_label ?? row.group_key,
      };
    }

    if (row.depends_on_key) {
      spec.visibleWhen = {
        key: row.depends_on_key,
        equals: row.depends_on_value,
      };
    }
    if (row.dependencies) spec.dependencies = this.rowToDependencies(row);

    return spec;
  }

  private rowToDependencies(row: ProviderParamSpecEntity): ProviderParamDependency[] {
    if (!Array.isArray(row.dependencies)) {
      throw new Error(`Invalid provider param dependencies: ${row.id}`);
    }

    return row.dependencies.map((dependency) => {
      if (!isRecord(dependency) || !isRecord(dependency.when)) {
        throw new Error(`Invalid provider param dependency: ${row.id}`);
      }
      if (dependency.effect !== 'disable' && dependency.effect !== 'omit') {
        throw new Error(`Invalid provider param dependency effect: ${row.id}`);
      }
      if (typeof dependency.when.key !== 'string' || dependency.when.key.length === 0) {
        throw new Error(`Invalid provider param dependency key: ${row.id}`);
      }
      const values = dependency.when.values;
      if (values !== undefined && !Array.isArray(values)) {
        throw new Error(`Invalid provider param dependency values: ${row.id}`);
      }

      return {
        effect: dependency.effect,
        when: {
          key: dependency.when.key,
          ...('equals' in dependency.when ? { equals: dependency.when.equals as JsonValue } : {}),
          ...(values !== undefined ? { values: values as JsonValue[] } : {}),
        },
      };
    });
  }

  private rowToControl(row: ProviderParamSpecEntity): ParamControl {
    switch (row.control_kind) {
      case 'toggle':
        if (!this.isStringTuple(row.values) || typeof row.default_value !== 'string') {
          throw new Error(`Invalid toggle provider param spec: ${row.id}`);
        }
        return {
          kind: 'toggle',
          label: row.label,
          values: row.values,
          default: row.default_value,
        };
      case 'select':
        if (!this.isStringArray(row.values) || typeof row.default_value !== 'string') {
          throw new Error(`Invalid select provider param spec: ${row.id}`);
        }
        return {
          kind: 'select',
          label: row.label,
          values: row.values,
          default: row.default_value,
        };
      case 'slider':
        if (
          typeof row.default_value !== 'number' ||
          typeof row.min_value !== 'number' ||
          typeof row.max_value !== 'number'
        ) {
          throw new Error(`Invalid slider provider param spec: ${row.id}`);
        }
        return {
          kind: 'slider',
          label: row.label,
          min: row.min_value,
          max: row.max_value,
          ...(typeof row.step_value === 'number' ? { step: row.step_value } : {}),
          default: row.default_value,
        };
      case 'number':
        if (typeof row.default_value !== 'number') {
          throw new Error(`Invalid number provider param spec: ${row.id}`);
        }
        return {
          kind: 'number',
          label: row.label,
          ...(typeof row.min_value === 'number' ? { min: row.min_value } : {}),
          ...(typeof row.max_value === 'number' ? { max: row.max_value } : {}),
          default: row.default_value,
        };
    }
  }

  private isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every((v) => typeof v === 'string');
  }

  private isStringTuple(value: unknown): value is [string, string] {
    return this.isStringArray(value) && value.length === 2;
  }
}

function serializeAnthropicThinking(value: JsonValue): Record<string, JsonValue> {
  if (!isRecord(value)) return {};

  if (value.type === 'adaptive') {
    return { thinking: { type: 'adaptive' } };
  }

  if (value.type !== 'enabled') return {};
  const budgetTokens = value.budget_tokens;
  if (typeof budgetTokens !== 'number' || !Number.isFinite(budgetTokens)) return {};
  return {
    thinking: {
      type: 'enabled',
      budget_tokens: Math.trunc(budgetTokens),
    },
  };
}

function isRecord(value: unknown): value is Record<string, JsonValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
