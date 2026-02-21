import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { auth } from '../auth/auth.instance';
import { Tenant } from '../entities/tenant.entity';
import { Agent } from '../entities/agent.entity';
import { AgentApiKey } from '../entities/agent-api-key.entity';
import { ModelPricing } from '../entities/model-pricing.entity';
import { sha256, keyPrefix } from '../common/utils/hash.util';
import { ModelPricingCacheService } from '../model-prices/model-pricing-cache.service';
import { PricingSyncService } from './pricing-sync.service';
import { LOCAL_EMAIL, LOCAL_PASSWORD } from '../common/constants/local-mode.constants';

const LOCAL_TENANT_ID = 'local-tenant-001';
const LOCAL_AGENT_ID = 'local-agent-001';
const LOCAL_AGENT_NAME = 'local-agent';

@Injectable()
export class LocalBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(LocalBootstrapService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(Agent) private readonly agentRepo: Repository<Agent>,
    @InjectRepository(AgentApiKey) private readonly agentKeyRepo: Repository<AgentApiKey>,
    @InjectRepository(ModelPricing) private readonly pricingRepo: Repository<ModelPricing>,
    private readonly pricingCache: ModelPricingCacheService,
    private readonly pricingSync: PricingSyncService,
  ) {}

  async onModuleInit() {
    await this.runBetterAuthMigrations();
    await this.seedModelPricing();
    await this.pricingCache.reload();
    await this.ensureLocalUser();
    await this.ensureTenantAndAgent();
    this.logger.log('Local mode bootstrap complete');

    // Fetch fresh prices from OpenRouter in the background
    this.pricingSync.syncPricing().catch((err) => {
      this.logger.warn(`Background pricing sync failed: ${err}`);
    });
  }

  private async runBetterAuthMigrations() {
    const ctx = await auth.$context;
    await ctx.runMigrations();
  }

  private async ensureLocalUser() {
    const exists = await this.checkUserExists(LOCAL_EMAIL);
    if (exists) return;

    try {
      await auth.api.signUpEmail({
        body: {
          email: LOCAL_EMAIL,
          password: LOCAL_PASSWORD,
          name: 'Local User',
        },
      });

      // Mark email as verified
      await this.dataSource.query(
        `UPDATE "user" SET "emailVerified" = 1 WHERE email = ?`,
        [LOCAL_EMAIL],
      );
      this.logger.log('Created local user');
    } catch (err) {
      this.logger.warn(`Failed to create local user: ${err instanceof Error ? err.message : err}`);
    }
  }

  private async checkUserExists(email: string): Promise<boolean> {
    try {
      const rows = await this.dataSource.query(
        `SELECT id FROM "user" WHERE email = ?`,
        [email],
      );
      return rows.length > 0;
    } catch {
      return false;
    }
  }

  private async ensureTenantAndAgent() {
    const count = await this.tenantRepo.count({ where: { id: LOCAL_TENANT_ID } });
    if (count > 0) return;

    const userId = await this.getBetterAuthUserId();
    if (!userId) {
      this.logger.warn('No local user found, skipping tenant/agent creation');
      return;
    }

    await this.tenantRepo.insert({
      id: LOCAL_TENANT_ID,
      name: userId,
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

    const apiKey = this.readApiKeyFromConfig();
    if (apiKey) {
      await this.registerApiKey(apiKey);
    }

    this.logger.log(`Created tenant/agent for local mode`);
  }

  private async getBetterAuthUserId(): Promise<string | null> {
    try {
      const rows = await this.dataSource.query(
        `SELECT id FROM "user" WHERE email = ?`,
        [LOCAL_EMAIL],
      );
      return rows.length > 0 ? String(rows[0].id) : null;
    } catch {
      return null;
    }
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

    const models: ReadonlyArray<readonly [string, string, number, number]> = [
      ['claude-opus-4-6',            'Anthropic', 0.000015,   0.000075  ],
      ['claude-sonnet-4-5-20250929', 'Anthropic', 0.000003,   0.000015  ],
      ['claude-sonnet-4-20250514',   'Anthropic', 0.000003,   0.000015  ],
      ['claude-haiku-4-5-20251001',  'Anthropic', 0.000001,   0.000005  ],
      ['gpt-4o',                     'OpenAI',    0.0000025,  0.00001   ],
      ['gpt-4o-mini',                'OpenAI',    0.00000015, 0.0000006 ],
      ['gpt-4.1',                    'OpenAI',    0.000002,   0.000008  ],
      ['gpt-4.1-mini',               'OpenAI',    0.0000004,  0.0000016 ],
      ['gpt-4.1-nano',               'OpenAI',    0.0000001,  0.0000004 ],
      ['o3',                         'OpenAI',    0.000002,   0.000008  ],
      ['o3-mini',                    'OpenAI',    0.0000011,  0.0000044 ],
      ['o4-mini',                    'OpenAI',    0.0000011,  0.0000044 ],
      ['gemini-2.5-pro',             'Google',    0.00000125, 0.00001   ],
      ['gemini-2.5-flash',           'Google',    0.00000015, 0.0000006 ],
      ['gemini-2.5-flash-lite',      'Google',    0.0000001,  0.0000004 ],
      ['gemini-2.0-flash',           'Google',    0.0000001,  0.0000004 ],
      ['deepseek-v3',                'DeepSeek',  0.00000014, 0.00000028],
      ['deepseek-r1',                'DeepSeek',  0.00000055, 0.00000219],
      ['kimi-k2',                    'Moonshot',  0.0000006,  0.0000024 ],
      ['qwen-2.5-72b-instruct',      'Alibaba',  0.00000034, 0.00000039],
      ['qwq-32b',                    'Alibaba',   0.00000012, 0.00000018],
      ['qwen-2.5-coder-32b-instruct','Alibaba',   0.00000018, 0.00000018],
      ['mistral-large',              'Mistral',   0.000002,   0.000006  ],
      ['mistral-small',              'Mistral',   0.0000002,  0.0000006 ],
      ['codestral',                  'Mistral',   0.0000003,  0.0000009 ],
      ['llama-4-maverick',           'Meta',      0.00000018, 0.00000059],
      ['llama-4-scout',              'Meta',      0.00000015, 0.00000044],
      ['command-r-plus',             'Cohere',    0.0000025,  0.00001   ],
      ['command-r',                  'Cohere',    0.00000015, 0.0000006 ],
    ];

    for (const [name, provider, inputPrice, outputPrice] of models) {
      await this.pricingRepo.upsert(
        { model_name: name, provider, input_price_per_token: inputPrice, output_price_per_token: outputPrice },
        ['model_name'],
      );
    }
    this.logger.log('Seeded model pricing data');
  }
}
