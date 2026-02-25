import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ModelPricing } from '../entities/model-pricing.entity';
import { ModelPricingCacheService } from '../model-prices/model-pricing-cache.service';
import { computeQualityScore } from './quality-score.util';
import { OLLAMA_HOST } from '../common/constants/ollama';

interface OllamaModel {
  name: string;
  details?: {
    family?: string;
    parameter_size?: string;
    quantization_level?: string;
  };
}

interface OllamaTagsResponse {
  models: OllamaModel[];
}

const REASONING_MODELS = new Set([
  'deepseek-r1',
  'qwq',
  'qwen3',
  'marco-o1',
  'smallthinker',
]);

const CODE_MODELS = new Set([
  'codellama',
  'codegemma',
  'codestral',
  'starcoder',
  'starcoder2',
  'deepseek-coder',
  'deepseek-coder-v2',
  'qwen2.5-coder',
]);

/** Models large enough to be generally capable at code. */
const LARGE_GENERAL_FAMILIES = new Set([
  'llama',
  'gemma',
  'gemma2',
  'qwen2',
  'qwen2.5',
  'qwen3',
  'mistral',
  'mixtral',
  'command-r',
  'phi3',
  'phi4',
]);

const CONTEXT_BY_FAMILY: Record<string, number> = {
  llama: 128000,
  gemma: 8192,
  gemma2: 8192,
  qwen2: 128000,
  'qwen2.5': 128000,
  qwen3: 128000,
  mistral: 32768,
  mixtral: 32768,
  phi3: 128000,
  phi4: 16384,
  'command-r': 128000,
};

function stripTag(name: string): string {
  return name.replace(/:latest$/, '');
}

function inferContext(family?: string): number {
  if (!family) return 128000;
  return CONTEXT_BY_FAMILY[family.toLowerCase()] ?? 128000;
}

function hasReasoningCapability(name: string): boolean {
  const lower = name.toLowerCase();
  for (const r of REASONING_MODELS) {
    if (lower.startsWith(r)) return true;
  }
  return false;
}

function hasCodeCapability(name: string, family?: string): boolean {
  const lower = name.toLowerCase();
  for (const c of CODE_MODELS) {
    if (lower.startsWith(c)) return true;
  }
  if (family && LARGE_GENERAL_FAMILIES.has(family.toLowerCase())) {
    return true;
  }
  return false;
}

@Injectable()
export class OllamaSyncService {
  private readonly logger = new Logger(OllamaSyncService.name);

  constructor(
    @InjectRepository(ModelPricing)
    private readonly pricingRepo: Repository<ModelPricing>,
    private readonly pricingCache: ModelPricingCacheService,
  ) {}

  async sync(): Promise<{ count: number }> {
    const url = `${OLLAMA_HOST}/api/tags`;
    let data: OllamaTagsResponse;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!res.ok) {
        this.logger.warn(`Ollama responded ${res.status} from ${url}`);
        return { count: 0 };
      }

      data = (await res.json()) as OllamaTagsResponse;
    } catch (err) {
      this.logger.warn(
        `Could not reach Ollama at ${url}: ${(err as Error).message}`,
      );
      return { count: 0 };
    }

    if (!data.models || data.models.length === 0) {
      this.logger.log('Ollama returned no models');
      return { count: 0 };
    }

    let count = 0;
    for (const model of data.models) {
      const modelName = stripTag(model.name);
      const family = model.details?.family;
      const hasReasoning = hasReasoningCapability(modelName);
      const hasCode = hasCodeCapability(modelName, family);
      const contextWindow = inferContext(family);

      const partial: Partial<ModelPricing> = {
        model_name: modelName,
        provider: 'Ollama',
        input_price_per_token: 0,
        output_price_per_token: 0,
        context_window: contextWindow,
        capability_reasoning: hasReasoning,
        capability_code: hasCode,
        updated_at: new Date(),
      };

      partial.quality_score = computeQualityScore(
        partial as ModelPricing,
      );

      await this.pricingRepo.upsert(partial, ['model_name']);
      count++;
    }

    await this.pricingCache.reload();
    this.logger.log(`Synced ${count} models from Ollama`);
    return { count };
  }
}
