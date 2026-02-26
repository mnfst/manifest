import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { Tenant } from '../entities/tenant.entity';
import { Agent } from '../entities/agent.entity';
import { AgentApiKey } from '../entities/agent-api-key.entity';
import { ModelPricing } from '../entities/model-pricing.entity';
import { sha256, keyPrefix } from '../common/utils/hash.util';
import { ModelPricingCacheService } from '../model-prices/model-pricing-cache.service';
import { PricingSyncService } from './pricing-sync.service';
import {
  LOCAL_USER_ID,
  LOCAL_EMAIL,
  LOCAL_TENANT_ID,
  LOCAL_AGENT_ID,
  LOCAL_AGENT_NAME,
} from '../common/constants/local-mode.constants';
import { trackEvent } from '../common/utils/product-telemetry';

@Injectable()
export class LocalBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(LocalBootstrapService.name);

  constructor(
    @InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(Agent) private readonly agentRepo: Repository<Agent>,
    @InjectRepository(AgentApiKey) private readonly agentKeyRepo: Repository<AgentApiKey>,
    @InjectRepository(ModelPricing) private readonly pricingRepo: Repository<ModelPricing>,
    private readonly pricingCache: ModelPricingCacheService,
    private readonly pricingSync: PricingSyncService,
  ) {}

  async onModuleInit() {
    await this.seedModelPricing();
    await this.pricingCache.reload();
    await this.ensureTenantAndAgent();
    this.logger.log('Local mode bootstrap complete');

    // Fetch fresh prices from OpenRouter in the background
    this.pricingSync.syncPricing().catch((err) => {
      this.logger.warn(`Background pricing sync failed: ${err}`);
    });
  }

  private async ensureTenantAndAgent() {
    const count = await this.tenantRepo.count({ where: { id: LOCAL_TENANT_ID } });
    if (count > 0) return;

    await this.tenantRepo.insert({
      id: LOCAL_TENANT_ID,
      name: LOCAL_USER_ID,
      organization_name: 'Local',
      email: LOCAL_EMAIL,
      is_active: true,
    });

    await this.agentRepo.insert({
      id: LOCAL_AGENT_ID,
      name: LOCAL_AGENT_NAME,
      description: 'Default local agent',
      is_active: true,
      tenant_id: LOCAL_TENANT_ID,
    });
    trackEvent('agent_created', { agent_name: LOCAL_AGENT_NAME });

    const apiKey = this.readApiKeyFromConfig();
    if (apiKey) {
      await this.registerApiKey(apiKey);
    }

    this.logger.log(`Created tenant/agent for local mode`);
  }

  private readApiKeyFromConfig(): string | null {
    try {
      const configPath = join(homedir(), '.openclaw', 'manifest', 'config.json');
      if (!existsSync(configPath)) return null;
      const data = JSON.parse(readFileSync(configPath, 'utf-8'));
      return typeof data.apiKey === 'string' ? data.apiKey : null;
    } catch {
      return null;
    }
  }

  private async registerApiKey(apiKey: string) {
    const hash = sha256(apiKey);
    const existing = await this.agentKeyRepo.count({ where: { key_hash: hash } });
    if (existing > 0) return;

    await this.agentKeyRepo.insert({
      id: 'local-otlp-key-001',
      key: null,
      key_hash: hash,
      key_prefix: keyPrefix(apiKey),
      label: 'Local OTLP ingest key',
      tenant_id: LOCAL_TENANT_ID,
      agent_id: LOCAL_AGENT_ID,
      is_active: true,
    });
  }

  private async seedModelPricing() {
    const count = await this.pricingRepo.count();
    if (count > 0) return;

    // [model_id, provider, input/tok, output/tok, context_window, reasoning, code]
    const models: ReadonlyArray<readonly [string, string, number, number, number, boolean, boolean]> = [
      ['claude-opus-4-6',            'Anthropic', 0.000015,   0.000075,   200000,  true,  true],
      ['claude-sonnet-4-5-20250929', 'Anthropic', 0.000003,   0.000015,   200000,  true,  true],
      ['claude-sonnet-4-20250514',   'Anthropic', 0.000003,   0.000015,   200000,  true,  true],
      ['claude-haiku-4-5-20251001',  'Anthropic', 0.000001,   0.000005,   200000,  false, true],
      ['gpt-4o',                     'OpenAI',    0.0000025,  0.00001,    128000,  false, true],
      ['gpt-4o-mini',                'OpenAI',    0.00000015, 0.0000006,  128000,  false, true],
      ['gpt-4.1',                    'OpenAI',    0.000002,   0.000008,   1047576, false, true],
      ['gpt-4.1-mini',               'OpenAI',    0.0000004,  0.0000016,  1047576, false, true],
      ['gpt-4.1-nano',               'OpenAI',    0.0000001,  0.0000004,  1047576, false, false],
      ['o3',                         'OpenAI',    0.000002,   0.000008,   200000,  true,  true],
      ['o3-mini',                    'OpenAI',    0.0000011,  0.0000044,  200000,  true,  true],
      ['o4-mini',                    'OpenAI',    0.0000011,  0.0000044,  200000,  true,  true],
      ['gpt-5.3',                    'OpenAI',    0.00001,    0.00003,    200000,  true,  true],
      ['gpt-5.3-codex',              'OpenAI',    0.00001,    0.00003,    200000,  true,  true],
      ['gpt-5.3-mini',               'OpenAI',    0.0000015,  0.000006,   200000,  true,  true],
      ['gemini-2.5-pro',             'Google',    0.00000125, 0.00001,    1048576, true,  true],
      ['gemini-2.5-flash',           'Google',    0.00000015, 0.0000006,  1048576, false, true],
      ['gemini-2.5-flash-lite',      'Google',    0.0000001,  0.0000004,  1048576, false, false],
      ['gemini-2.0-flash',           'Google',    0.0000001,  0.0000004,  1048576, false, true],
      ['deepseek-v3',                'DeepSeek',  0.00000014, 0.00000028, 128000,  false, true],
      ['deepseek-r1',                'DeepSeek',  0.00000055, 0.00000219, 128000,  true,  false],
      ['kimi-k2',                    'Moonshot',  0.0000006,  0.0000024,  262144,  true,  true],
      ['qwen-2.5-72b-instruct',      'Alibaba',  0.00000034, 0.00000039, 131072,  false, true],
      ['qwq-32b',                    'Alibaba',   0.00000012, 0.00000018, 131072,  true,  false],
      ['qwen-2.5-coder-32b-instruct','Alibaba',   0.00000018, 0.00000018, 131072,  false, true],
      ['qwen3-235b-a22b',            'Alibaba',   0.0000003,  0.0000012,  131072,  true,  true],
      ['qwen3-32b',                  'Alibaba',   0.0000001,  0.0000003,  131072,  true,  true],
      ['mistral-large',              'Mistral',   0.000002,   0.000006,   128000,  false, true],
      ['mistral-small',              'Mistral',   0.0000002,  0.0000006,  128000,  false, false],
      ['codestral',                  'Mistral',   0.0000003,  0.0000009,  256000,  false, true],
      ['grok-3',                     'xAI',       0.000003,   0.000015,   131072,  true,  true],
      ['grok-3-mini',                'xAI',       0.0000003,  0.0000005,  131072,  true,  true],
      ['grok-3-fast',                'xAI',       0.000005,   0.000025,   131072,  false, true],
      ['grok-3-mini-fast',           'xAI',       0.0000006,  0.000004,   131072,  false, true],
      ['grok-2',                     'xAI',       0.000002,   0.00001,    131072,  false, true],
      ['glm-4-plus',                 'Zhipu',     0.0000005,  0.0000005,  128000,  false, true],
      ['glm-4-flash',                'Zhipu',     0.00000005, 0.00000005, 128000,  false, false],
      ['nova-pro',                   'Amazon',    0.0000008,  0.0000032,  300000,  false, true],
      ['nova-lite',                  'Amazon',    0.00000006, 0.00000024, 300000,  false, true],
      ['nova-micro',                 'Amazon',    0.000000035,0.00000014, 128000,  false, false],
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
    this.logger.log('Seeded model pricing data');
  }
}
