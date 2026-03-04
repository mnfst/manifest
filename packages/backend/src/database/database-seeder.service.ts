import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { auth } from '../auth/auth.instance';
import { ModelPricing } from '../entities/model-pricing.entity';
import { ModelPricingCacheService } from '../model-prices/model-pricing-cache.service';

@Injectable()
export class DatabaseSeederService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseSeederService.name);

  constructor(
    @InjectRepository(ModelPricing) private readonly pricingRepo: Repository<ModelPricing>,
    private readonly pricingCache: ModelPricingCacheService,
  ) {}

  async onModuleInit() {
    // In local mode, LocalBootstrapService handles initialization
    if (process.env['MANIFEST_MODE'] === 'local') return;

    await this.runBetterAuthMigrations();
    await this.seedModelPricing();
  }

  private async runBetterAuthMigrations() {
    const ctx = await auth!.$context;
    await ctx.runMigrations();
  }

  private async seedModelPricing() {
    // Always upsert the curated model list so missing models are re-added.
    // quality_score is NOT stored here — it is computed dynamically by
    // computeQualityScore() during every cache reload (boot + cron sync).
    // [model_id, provider, input/tok, output/tok, context_window, reasoning, code]
    // Source: official pricing pages (Feb 2026)
    const models: ReadonlyArray<
      readonly [string, string, number, number, number, boolean, boolean]
    > = [
      // Anthropic Claude
      ['claude-opus-4-6', 'Anthropic', 0.000015, 0.000075, 200000, true, true],
      ['claude-sonnet-4-5-20250929', 'Anthropic', 0.000003, 0.000015, 200000, true, true],
      ['claude-sonnet-4-20250514', 'Anthropic', 0.000003, 0.000015, 200000, true, true],
      ['claude-haiku-4-5-20251001', 'Anthropic', 0.000001, 0.000005, 200000, false, true],
      // OpenAI GPT
      ['gpt-4o', 'OpenAI', 0.0000025, 0.00001, 128000, false, true],
      ['gpt-4o-mini', 'OpenAI', 0.00000015, 0.0000006, 128000, false, true],
      ['gpt-4.1', 'OpenAI', 0.000002, 0.000008, 1047576, false, true],
      ['gpt-4.1-mini', 'OpenAI', 0.0000004, 0.0000016, 1047576, false, true],
      ['gpt-4.1-nano', 'OpenAI', 0.0000001, 0.0000004, 1047576, false, false],
      // OpenAI reasoning
      ['o3', 'OpenAI', 0.000002, 0.000008, 200000, true, true],
      ['o3-mini', 'OpenAI', 0.0000011, 0.0000044, 200000, true, true],
      ['o4-mini', 'OpenAI', 0.0000011, 0.0000044, 200000, true, true],
      // OpenAI GPT-5.3
      ['gpt-5.3', 'OpenAI', 0.00001, 0.00003, 200000, true, true],
      ['gpt-5.3-codex', 'OpenAI', 0.00001, 0.00003, 200000, true, true],
      ['gpt-5.3-mini', 'OpenAI', 0.0000015, 0.000006, 200000, true, true],
      // Google Gemini
      ['gemini-2.5-pro', 'Google', 0.00000125, 0.00001, 1048576, true, true],
      ['gemini-2.5-flash', 'Google', 0.00000015, 0.0000006, 1048576, false, true],
      ['gemini-2.5-flash-lite', 'Google', 0.0000001, 0.0000004, 1048576, false, false],
      ['gemini-2.0-flash', 'Google', 0.0000001, 0.0000004, 1048576, false, true],
      // DeepSeek
      ['deepseek-v3', 'DeepSeek', 0.00000014, 0.00000028, 128000, false, true],
      ['deepseek-r1', 'DeepSeek', 0.00000055, 0.00000219, 128000, true, false],
      // Moonshot (Kimi)
      ['kimi-k2', 'Moonshot', 0.0000006, 0.0000024, 262144, true, true],
      // Alibaba (Qwen)
      ['qwen-2.5-72b-instruct', 'Alibaba', 0.00000034, 0.00000039, 131072, false, true],
      ['qwq-32b', 'Alibaba', 0.00000012, 0.00000018, 131072, true, false],
      ['qwen-2.5-coder-32b-instruct', 'Alibaba', 0.00000018, 0.00000018, 131072, false, true],
      ['qwen3-235b-a22b', 'Alibaba', 0.0000003, 0.0000012, 131072, true, true],
      ['qwen3-32b', 'Alibaba', 0.0000001, 0.0000003, 131072, true, true],
      // Mistral
      ['mistral-large', 'Mistral', 0.000002, 0.000006, 128000, false, true],
      ['mistral-small', 'Mistral', 0.0000002, 0.0000006, 128000, false, false],
      ['codestral', 'Mistral', 0.0000003, 0.0000009, 256000, false, true],
      // xAI (Grok)
      ['grok-3', 'xAI', 0.000003, 0.000015, 131072, true, true],
      ['grok-3-mini', 'xAI', 0.0000003, 0.0000005, 131072, true, true],
      ['grok-3-fast', 'xAI', 0.000005, 0.000025, 131072, false, true],
      ['grok-3-mini-fast', 'xAI', 0.0000006, 0.000004, 131072, false, true],
      ['grok-2', 'xAI', 0.000002, 0.00001, 131072, false, true],
      // OpenRouter
      ['openrouter/auto', 'OpenRouter', 0.000003, 0.000015, 200000, true, true],
      ['anthropic/claude-opus-4-6', 'OpenRouter', 0.000015, 0.000075, 200000, true, true],
      ['anthropic/claude-sonnet-4-5', 'OpenRouter', 0.000003, 0.000015, 200000, true, true],
      ['openai/gpt-4o', 'OpenRouter', 0.0000025, 0.00001, 128000, false, true],
      ['openai/o3', 'OpenRouter', 0.000002, 0.000008, 200000, true, true],
      ['google/gemini-2.5-pro', 'OpenRouter', 0.00000125, 0.00001, 1048576, true, true],
      ['google/gemini-2.5-flash', 'OpenRouter', 0.00000015, 0.0000006, 1048576, false, true],
      ['deepseek/deepseek-r1', 'OpenRouter', 0.00000055, 0.00000219, 128000, true, false],
      ['deepseek/deepseek-chat-v3-0324', 'OpenRouter', 0.00000014, 0.00000028, 128000, false, true],
      ['meta-llama/llama-4-maverick', 'OpenRouter', 0.0000003, 0.0000009, 128000, false, true],
      ['mistralai/mistral-large', 'OpenRouter', 0.000002, 0.000006, 128000, false, true],
      ['x-ai/grok-3', 'OpenRouter', 0.000003, 0.000015, 131072, true, true],
      // OpenRouter free models
      ['openrouter/free', 'OpenRouter', 0, 0, 200000, true, true],
      ['stepfun/step-3.5-flash:free', 'OpenRouter', 0, 0, 256000, false, true],
      ['arcee-ai/trinity-large-preview:free', 'OpenRouter', 0, 0, 131072, false, true],
      ['upstage/solar-pro-3:free', 'OpenRouter', 0, 0, 128000, false, true],
      ['liquid/lfm-2.5-1.2b-thinking:free', 'OpenRouter', 0, 0, 32768, true, false],
      ['liquid/lfm-2.5-1.2b-instruct:free', 'OpenRouter', 0, 0, 32768, false, false],
      ['arcee-ai/trinity-mini:free', 'OpenRouter', 0, 0, 131072, false, false],
      ['nvidia/nemotron-3-nano-30b-a3b:free', 'OpenRouter', 0, 0, 256000, false, true],
      ['minimax/minimax-m2.5', 'OpenRouter', 0.000000295, 0.0000012, 196608, true, true],
      ['minimax/minimax-m1', 'OpenRouter', 0.0000004, 0.0000022, 1000000, true, true],
      // MiniMax
      ['minimax-m2.5', 'MiniMax', 0.000000295, 0.0000012, 196608, true, true],
      ['minimax-m2.5-highspeed', 'MiniMax', 0.000000295, 0.0000012, 196608, true, true],
      ['minimax-m2.1', 'MiniMax', 0.00000027, 0.00000095, 196608, true, true],
      ['minimax-m2.1-highspeed', 'MiniMax', 0.00000027, 0.00000095, 196608, true, true],
      ['minimax-m2', 'MiniMax', 0.000000255, 0.000001, 196608, true, true],
      ['minimax-m2-her', 'MiniMax', 0.0000003, 0.0000012, 65536, false, false],
      ['minimax-m1', 'MiniMax', 0.0000004, 0.0000022, 1000000, true, true],
      ['minimax-01', 'MiniMax', 0.0000002, 0.0000011, 1000192, false, false],
      // Z.ai (GLM)
      ['glm-5', 'Z.ai', 0.00000095, 0.00000255, 204800, true, true],
      ['glm-4.7', 'Z.ai', 0.0000003, 0.0000014, 202752, true, true],
      ['glm-4.7-flash', 'Z.ai', 0.00000006, 0.0000004, 202752, false, false],
      ['glm-4.6', 'Z.ai', 0.00000035, 0.00000171, 202752, true, true],
      ['glm-4.6v', 'Z.ai', 0.0000003, 0.0000009, 131072, false, false],
      ['glm-4.5', 'Z.ai', 0.00000055, 0.000002, 131000, true, true],
      ['glm-4.5-air', 'Z.ai', 0.00000013, 0.00000085, 131072, false, false],
      ['glm-4.5-flash', 'Z.ai', 0, 0, 131072, false, false],
      // OpenRouter Z.ai copies
      ['z-ai/glm-5', 'OpenRouter', 0.00000095, 0.00000255, 204800, true, true],
      ['z-ai/glm-4.7', 'OpenRouter', 0.0000003, 0.0000014, 202752, true, true],
      // Zhipu (GLM) — legacy
      ['glm-4-plus', 'Zhipu', 0.0000005, 0.0000005, 128000, false, true],
      ['glm-4-flash', 'Zhipu', 0.00000005, 0.00000005, 128000, false, false],
      // Amazon Nova
      ['nova-pro', 'Amazon', 0.0000008, 0.0000032, 300000, false, true],
      ['nova-lite', 'Amazon', 0.00000006, 0.00000024, 300000, false, true],
      ['nova-micro', 'Amazon', 0.000000035, 0.00000014, 128000, false, false],
    ];

    for (const [name, provider, inputPrice, outputPrice, ctxWindow, reasoning, code] of models) {
      await this.pricingRepo.upsert(
        {
          model_name: name,
          provider,
          input_price_per_token: inputPrice,
          output_price_per_token: outputPrice,
          context_window: ctxWindow,
          capability_reasoning: reasoning,
          capability_code: code,
        },
        ['model_name'],
      );
    }
    await this.pricingCache.reload();
    this.logger.log('Seeded model pricing data');
  }
}
