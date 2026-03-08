import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { auth } from '../auth/auth.instance';
import { Tenant } from '../entities/tenant.entity';
import { Agent } from '../entities/agent.entity';
import { AgentApiKey } from '../entities/agent-api-key.entity';
import { ApiKey } from '../entities/api-key.entity';
import { ModelPricing } from '../entities/model-pricing.entity';
import { SecurityEvent } from '../entities/security-event.entity';
import { AgentMessage } from '../entities/agent-message.entity';
import { hashKey, keyPrefix } from '../common/utils/hash.util';
import { ModelPricingCacheService } from '../model-prices/model-pricing-cache.service';
import { seedAgentMessages } from './seed-messages';

const SEED_API_KEY = 'dev-api-key-manifest-001';
const SEED_OTLP_KEY = 'mnfst_dev-otlp-key-001';
const SEED_TENANT_ID = 'seed-tenant-001';
const SEED_AGENT_ID = 'seed-agent-001';

@Injectable()
export class DatabaseSeederService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseSeederService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    @InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(Agent) private readonly agentRepo: Repository<Agent>,
    @InjectRepository(AgentApiKey) private readonly agentKeyRepo: Repository<AgentApiKey>,
    @InjectRepository(ApiKey) private readonly apiKeyRepo: Repository<ApiKey>,
    @InjectRepository(ModelPricing) private readonly pricingRepo: Repository<ModelPricing>,
    @InjectRepository(SecurityEvent) private readonly securityRepo: Repository<SecurityEvent>,
    @InjectRepository(AgentMessage) private readonly messageRepo: Repository<AgentMessage>,
    private readonly pricingCache: ModelPricingCacheService,
  ) {}

  async onModuleInit() {
    // In local mode, LocalBootstrapService handles initialization
    if (process.env['MANIFEST_MODE'] === 'local') return;

    await this.runBetterAuthMigrations();
    await this.seedModelPricing();

    const env = this.configService.get<string>('app.nodeEnv', 'production');
    const shouldSeed =
      (env === 'development' || env === 'test') && process.env['SEED_DATA'] === 'true';
    if (shouldSeed) {
      await this.seedAdminUser();
      await this.seedApiKey();
      await this.seedTenantAndAgent();
      await this.seedSecurityEvents();
      await this.seedAgentMessages();
      this.logger.log('Seeded demo data (dev/test only, SEED_DATA=true)');
    }
  }

  private async runBetterAuthMigrations() {
    const ctx = await auth!.$context;
    await ctx.runMigrations();
  }

  private async seedAdminUser() {
    const existing = await this.checkBetterAuthUser('admin@manifest.build');
    if (existing) return;

    await auth!.api.signUpEmail({
      body: {
        email: 'admin@manifest.build',
        password: 'manifest',
        name: 'Admin',
      },
    });

    // Mark email as verified so the seed user can log in without Mailgun
    await this.dataSource.query(`UPDATE "user" SET "emailVerified" = true WHERE email = $1`, [
      'admin@manifest.build',
    ]);
  }

  private async checkBetterAuthUser(email: string): Promise<boolean> {
    try {
      const rows = await this.dataSource.query(`SELECT id FROM "user" WHERE email = $1`, [email]);
      return rows.length > 0;
    } catch (err) {
      this.logger.warn(
        `Failed to check Better Auth user: ${err instanceof Error ? err.message : err}`,
      );
      return false;
    }
  }

  private async seedApiKey() {
    const count = await this.apiKeyRepo.count({ where: { id: 'seed-api-key-001' } });
    if (count > 0) return;

    const userId = await this.getAdminUserId();
    if (!userId) return;

    await this.apiKeyRepo.insert({
      id: 'seed-api-key-001',
      key: null,
      key_hash: hashKey(SEED_API_KEY),
      key_prefix: keyPrefix(SEED_API_KEY),
      user_id: userId,
      name: 'Development API Key',
    });
  }

  private async getAdminUserId(): Promise<string | null> {
    try {
      const rows = await this.dataSource.query(`SELECT id FROM "user" WHERE email = $1`, [
        'admin@manifest.build',
      ]);
      return rows.length > 0 ? String(rows[0].id) : null;
    } catch (err) {
      this.logger.warn(`Failed to get admin user ID: ${err instanceof Error ? err.message : err}`);
      return null;
    }
  }

  private async seedTenantAndAgent() {
    const count = await this.tenantRepo.count({ where: { id: SEED_TENANT_ID } });
    if (count > 0) return;

    const userId = await this.getAdminUserId();
    if (!userId) return;

    await this.tenantRepo.insert({
      id: SEED_TENANT_ID,
      name: userId,
      organization_name: 'Demo Organization',
      email: 'admin@manifest.build',
      is_active: true,
    });

    await this.agentRepo.insert({
      id: SEED_AGENT_ID,
      name: 'demo-agent',
      description: 'Default development agent',
      is_active: true,
      tenant_id: SEED_TENANT_ID,
    });

    await this.agentKeyRepo.insert({
      id: 'seed-otlp-key-001',
      key: null,
      key_hash: hashKey(SEED_OTLP_KEY),
      key_prefix: keyPrefix(SEED_OTLP_KEY),
      label: 'Demo OTLP ingest key',
      tenant_id: SEED_TENANT_ID,
      agent_id: SEED_AGENT_ID,
      is_active: true,
    });

    this.logger.log(`Seeded tenant/agent with OTLP key: ${SEED_OTLP_KEY.substring(0, 8)}***`);
  }

  private async seedModelPricing() {
    // Always upsert the curated model list so missing models are re-added.
    // quality_score is NOT stored here — it is computed dynamically by
    // computeQualityScore() during every cache reload (boot + cron sync).
    // [model_id, provider, input/tok, output/tok, context_window, reasoning, code, display_name]
    // Source: official pricing pages (Feb 2026)
    const models: ReadonlyArray<
      readonly [string, string, number, number, number, boolean, boolean, string]
    > = [
      // Anthropic Claude
      ['claude-opus-4-6', 'Anthropic', 0.000015, 0.000075, 200000, true, true, 'Claude Opus 4.6'],
      [
        'claude-sonnet-4-5-20250929',
        'Anthropic',
        0.000003,
        0.000015,
        200000,
        true,
        true,
        'Claude Sonnet 4.5',
      ],
      [
        'claude-sonnet-4-20250514',
        'Anthropic',
        0.000003,
        0.000015,
        200000,
        true,
        true,
        'Claude Sonnet 4',
      ],
      [
        'claude-haiku-4-5-20251001',
        'Anthropic',
        0.000001,
        0.000005,
        200000,
        false,
        true,
        'Claude Haiku 4.5',
      ],
      // OpenAI GPT
      ['gpt-4o', 'OpenAI', 0.0000025, 0.00001, 128000, false, true, 'GPT-4o'],
      ['gpt-4o-mini', 'OpenAI', 0.00000015, 0.0000006, 128000, false, true, 'GPT-4o Mini'],
      ['gpt-4.1', 'OpenAI', 0.000002, 0.000008, 1047576, false, true, 'GPT-4.1'],
      ['gpt-4.1-mini', 'OpenAI', 0.0000004, 0.0000016, 1047576, false, true, 'GPT-4.1 Mini'],
      ['gpt-4.1-nano', 'OpenAI', 0.0000001, 0.0000004, 1047576, false, false, 'GPT-4.1 Nano'],
      // OpenAI reasoning
      ['o3', 'OpenAI', 0.000002, 0.000008, 200000, true, true, 'o3'],
      ['o3-mini', 'OpenAI', 0.0000011, 0.0000044, 200000, true, true, 'o3 Mini'],
      ['o4-mini', 'OpenAI', 0.0000011, 0.0000044, 200000, true, true, 'o4 Mini'],
      // Google Gemini
      ['gemini-2.5-pro', 'Google', 0.00000125, 0.00001, 1048576, true, true, 'Gemini 2.5 Pro'],
      [
        'gemini-2.5-flash',
        'Google',
        0.00000015,
        0.0000006,
        1048576,
        false,
        true,
        'Gemini 2.5 Flash',
      ],
      [
        'gemini-2.5-flash-lite',
        'Google',
        0.0000001,
        0.0000004,
        1048576,
        false,
        false,
        'Gemini 2.5 Flash Lite',
      ],
      [
        'gemini-2.0-flash',
        'Google',
        0.0000001,
        0.0000004,
        1048576,
        false,
        true,
        'Gemini 2.0 Flash',
      ],
      // DeepSeek
      ['deepseek-chat', 'DeepSeek', 0.00000014, 0.00000028, 128000, false, true, 'DeepSeek V3'],
      ['deepseek-reasoner', 'DeepSeek', 0.00000055, 0.00000219, 128000, true, false, 'DeepSeek R1'],
      // Moonshot (Kimi)
      ['kimi-k2', 'Moonshot', 0.0000006, 0.0000024, 262144, true, true, 'Kimi k2'],
      // Alibaba (Qwen)
      [
        'qwen-2.5-72b-instruct',
        'Alibaba',
        0.00000034,
        0.00000039,
        131072,
        false,
        true,
        'Qwen2.5 72B Instruct',
      ],
      ['qwq-32b', 'Alibaba', 0.00000012, 0.00000018, 131072, true, false, 'QwQ 32B'],
      [
        'qwen-2.5-coder-32b-instruct',
        'Alibaba',
        0.00000018,
        0.00000018,
        131072,
        false,
        true,
        'Qwen2.5 Coder 32B',
      ],
      ['qwen3-235b-a22b', 'Alibaba', 0.0000003, 0.0000012, 131072, true, true, 'Qwen3 235B A22B'],
      ['qwen3-32b', 'Alibaba', 0.0000001, 0.0000003, 131072, true, true, 'Qwen3 32B'],
      // Mistral
      ['mistral-large-latest', 'Mistral', 0.000002, 0.000006, 128000, false, true, 'Mistral Large'],
      ['mistral-small', 'Mistral', 0.0000002, 0.0000006, 128000, false, false, 'Mistral Small'],
      ['codestral-latest', 'Mistral', 0.0000003, 0.0000009, 256000, false, true, 'Codestral'],
      // xAI (Grok)
      ['grok-3', 'xAI', 0.000003, 0.000015, 131072, true, true, 'Grok 3'],
      ['grok-3-mini', 'xAI', 0.0000003, 0.0000005, 131072, true, true, 'Grok 3 Mini'],
      ['grok-3-fast', 'xAI', 0.000005, 0.000025, 131072, false, true, 'Grok 3 Fast'],
      ['grok-3-mini-fast', 'xAI', 0.0000006, 0.000004, 131072, false, true, 'Grok 3 Mini Fast'],
      // OpenRouter
      [
        'openrouter/auto',
        'OpenRouter',
        0.000003,
        0.000015,
        200000,
        true,
        true,
        'Auto (best for prompt)',
      ],
      [
        'anthropic/claude-opus-4-6',
        'OpenRouter',
        0.000015,
        0.000075,
        200000,
        true,
        true,
        'Claude Opus 4.6',
      ],
      [
        'anthropic/claude-sonnet-4-5',
        'OpenRouter',
        0.000003,
        0.000015,
        200000,
        true,
        true,
        'Claude Sonnet 4.5',
      ],
      ['openai/gpt-4o', 'OpenRouter', 0.0000025, 0.00001, 128000, false, true, 'GPT-4o'],
      ['openai/o3', 'OpenRouter', 0.000002, 0.000008, 200000, true, true, 'o3'],
      [
        'google/gemini-2.5-pro',
        'OpenRouter',
        0.00000125,
        0.00001,
        1048576,
        true,
        true,
        'Gemini 2.5 Pro',
      ],
      [
        'google/gemini-2.5-flash',
        'OpenRouter',
        0.00000015,
        0.0000006,
        1048576,
        false,
        true,
        'Gemini 2.5 Flash',
      ],
      [
        'deepseek/deepseek-r1',
        'OpenRouter',
        0.00000055,
        0.00000219,
        128000,
        true,
        false,
        'DeepSeek R1',
      ],
      [
        'deepseek/deepseek-chat-v3-0324',
        'OpenRouter',
        0.00000014,
        0.00000028,
        128000,
        false,
        true,
        'DeepSeek V3 (0324)',
      ],
      [
        'meta-llama/llama-4-maverick',
        'OpenRouter',
        0.0000003,
        0.0000009,
        128000,
        false,
        true,
        'Llama 4 Maverick',
      ],
      [
        'mistralai/mistral-large',
        'OpenRouter',
        0.000002,
        0.000006,
        128000,
        false,
        true,
        'Mistral Large',
      ],
      ['x-ai/grok-3', 'OpenRouter', 0.000003, 0.000015, 131072, true, true, 'Grok 3'],
      // OpenRouter free models
      ['openrouter/free', 'OpenRouter', 0, 0, 200000, true, true, 'Free Models Router'],
      [
        'minimax/minimax-m2.5',
        'OpenRouter',
        0.000000295,
        0.0000012,
        196608,
        true,
        true,
        'MiniMax M2.5',
      ],
      ['minimax/minimax-m1', 'OpenRouter', 0.0000004, 0.0000022, 1000000, true, true, 'MiniMax M1'],
      // MiniMax
      ['minimax-m2.5', 'MiniMax', 0.000000295, 0.0000012, 196608, true, true, 'MiniMax M2.5'],
      [
        'minimax-m2.5-highspeed',
        'MiniMax',
        0.000000295,
        0.0000012,
        196608,
        true,
        true,
        'MiniMax M2.5 Highspeed',
      ],
      ['minimax-m2.1', 'MiniMax', 0.00000027, 0.00000095, 196608, true, true, 'MiniMax M2.1'],
      [
        'minimax-m2.1-highspeed',
        'MiniMax',
        0.00000027,
        0.00000095,
        196608,
        true,
        true,
        'MiniMax M2.1 Highspeed',
      ],
      ['minimax-m2', 'MiniMax', 0.000000255, 0.000001, 196608, true, true, 'MiniMax M2'],
      ['minimax-m1', 'MiniMax', 0.0000004, 0.0000022, 1000000, true, true, 'MiniMax M1'],
      // Z.ai (GLM)
      ['glm-5', 'Z.ai', 0.00000095, 0.00000255, 204800, true, true, 'GLM 5'],
      ['glm-4.7', 'Z.ai', 0.0000003, 0.0000014, 202752, true, true, 'GLM 4.7'],
      ['glm-4.7-flash', 'Z.ai', 0.00000006, 0.0000004, 202752, false, false, 'GLM 4.7 Flash'],
      ['glm-4.6', 'Z.ai', 0.00000035, 0.00000171, 202752, true, true, 'GLM 4.6'],
      ['glm-4.6v', 'Z.ai', 0.0000003, 0.0000009, 131072, false, false, 'GLM 4.6V'],
      ['glm-4.5', 'Z.ai', 0.00000055, 0.000002, 131000, true, true, 'GLM 4.5'],
      ['glm-4.5-air', 'Z.ai', 0.00000013, 0.00000085, 131072, false, false, 'GLM 4.5 Air'],
      ['glm-4.5-flash', 'Z.ai', 0, 0, 131072, false, false, 'GLM 4.5 Flash'],
      // OpenRouter Z.ai copies
      ['z-ai/glm-5', 'OpenRouter', 0.00000095, 0.00000255, 204800, true, true, 'GLM 5'],
      ['z-ai/glm-4.7', 'OpenRouter', 0.0000003, 0.0000014, 202752, true, true, 'GLM 4.7'],
      // Zhipu (GLM) — legacy
      ['glm-4-plus', 'Zhipu', 0.0000005, 0.0000005, 128000, false, true, 'GLM 4 Plus'],
      ['glm-4-flash', 'Zhipu', 0.00000005, 0.00000005, 128000, false, false, 'GLM 4 Flash'],
    ];

    for (const [
      name,
      provider,
      inputPrice,
      outputPrice,
      ctxWindow,
      reasoning,
      code,
      displayName,
    ] of models) {
      await this.pricingRepo.upsert(
        {
          model_name: name,
          provider,
          input_price_per_token: inputPrice,
          output_price_per_token: outputPrice,
          context_window: ctxWindow,
          capability_reasoning: reasoning,
          capability_code: code,
          display_name: displayName,
        },
        ['model_name'],
      );
    }
    await this.pricingCache.reload();
    this.logger.log('Seeded model pricing data');
  }

  private async seedSecurityEvents() {
    const count = await this.securityRepo.count();
    if (count > 0) return;

    const userId = await this.getAdminUserId();

    const now = Date.now();
    const events = [
      [
        'sec-001',
        'sess-001',
        -2,
        'critical',
        'unauthorized_access',
        'Unauthorized API key attempt from unknown IP',
      ],
      [
        'sec-002',
        'sess-002',
        -3,
        'warning',
        'rate_limit',
        'Rate limit exceeded for agent — 150 req/min threshold',
      ],
      [
        'sec-003',
        'sess-003',
        -5,
        'info',
        'config_change',
        'Alert rule "High cost threshold" updated by admin',
      ],
      [
        'sec-004',
        'sess-004',
        -6,
        'warning',
        'sandbox_escape',
        'Sandbox escape attempt detected in agent session',
      ],
      [
        'sec-005',
        'sess-005',
        -8,
        'critical',
        'data_exfiltration',
        'Suspicious outbound data transfer detected',
      ],
      ['sec-006', 'sess-006', -10, 'info', 'login', 'New login from device'],
      [
        'sec-007',
        'sess-007',
        -12,
        'warning',
        'permission_escalation',
        'Agent requested elevated permissions outside scope',
      ],
      [
        'sec-008',
        'sess-008',
        -14,
        'info',
        'api_key_rotation',
        'API key rotated for production environment',
      ],
      [
        'sec-009',
        'sess-009',
        -18,
        'critical',
        'injection_attempt',
        'Prompt injection attempt detected in agent input',
      ],
      [
        'sec-010',
        'sess-010',
        -22,
        'warning',
        'token_anomaly',
        'Unusual token consumption spike: 340% above baseline',
      ],
      [
        'sec-011',
        'sess-011',
        -24,
        'info',
        'audit',
        'Weekly security audit completed — 3 findings resolved',
      ],
      ['sec-012', 'sess-012', -48, 'warning', 'certificate', 'TLS certificate expiring in 14 days'],
    ] as const;

    for (const [id, sessionKey, hoursAgo, severity, category, description] of events) {
      const ts = new Date(now + hoursAgo * 3600000).toISOString();
      await this.securityRepo.insert({
        id,
        session_key: sessionKey,
        timestamp: ts,
        severity,
        category,
        description,
        user_id: userId,
      });
    }
  }

  private async seedAgentMessages() {
    const userId = await this.getAdminUserId();
    if (!userId) return;
    await seedAgentMessages(this.messageRepo, userId, this.logger);
  }
}
