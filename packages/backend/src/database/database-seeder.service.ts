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
import { sha256, keyPrefix } from '../common/utils/hash.util';

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
  ) {}

  async onModuleInit() {
    // In local mode, LocalBootstrapService handles initialization
    if (process.env['MANIFEST_MODE'] === 'local') return;

    await this.runBetterAuthMigrations();
    await this.seedModelPricing();

    const env = this.configService.get<string>('app.nodeEnv', 'production');
    const shouldSeed = (env === 'development' || env === 'test') && process.env['SEED_DATA'] === 'true';
    if (shouldSeed) {
      await this.seedAdminUser();
      await this.seedApiKey();
      await this.seedTenantAndAgent();
      await this.seedSecurityEvents();
      this.logger.log('Seeded demo data (dev/test only, SEED_DATA=true)');
    }
  }

  private async runBetterAuthMigrations() {
    const ctx = await auth.$context;
    await ctx.runMigrations();
  }

  private async seedAdminUser() {
    const existing = await this.checkBetterAuthUser('admin@manifest.build');
    if (existing) return;

    await auth.api.signUpEmail({
      body: {
        email: 'admin@manifest.build',
        password: 'manifest',
        name: 'Admin',
      },
    });

    // Mark email as verified so the seed user can log in without Mailgun
    await this.dataSource.query(
      `UPDATE "user" SET "emailVerified" = true WHERE email = $1`,
      ['admin@manifest.build'],
    );
  }

  private async checkBetterAuthUser(email: string): Promise<boolean> {
    try {
      const rows = await this.dataSource.query(
        `SELECT id FROM "user" WHERE email = $1`,
        [email],
      );
      return rows.length > 0;
    } catch (err) {
      this.logger.warn(`Failed to check Better Auth user: ${err instanceof Error ? err.message : err}`);
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
      key_hash: sha256(SEED_API_KEY),
      key_prefix: keyPrefix(SEED_API_KEY),
      user_id: userId,
      name: 'Development API Key',
    });
  }

  private async getAdminUserId(): Promise<string | null> {
    try {
      const rows = await this.dataSource.query(
        `SELECT id FROM "user" WHERE email = $1`,
        ['admin@manifest.build'],
      );
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
      key_hash: sha256(SEED_OTLP_KEY),
      key_prefix: keyPrefix(SEED_OTLP_KEY),
      label: 'Demo OTLP ingest key',
      tenant_id: SEED_TENANT_ID,
      agent_id: SEED_AGENT_ID,
      is_active: true,
    });

    this.logger.log(`Seeded tenant/agent with OTLP key: ${SEED_OTLP_KEY.substring(0, 8)}***`);
  }

  private async seedModelPricing() {
    // Always upsert the curated model list so missing models are re-added
    // and existing ones keep their seeded quality_score / capabilities.
    // [model_id, provider, input/tok, output/tok, context_window, reasoning, code, quality]
    // quality_score: 5=frontier, 4=tier-1.5, 3=mid-range, 2=cost-optimized, 1=ultra-low-cost
    // Source: official pricing pages (Feb 2026)
    const models: ReadonlyArray<readonly [string, string, number, number, number, boolean, boolean, number]> = [
      // Anthropic Claude
      ['claude-opus-4-6',            'Anthropic', 0.000015,   0.000075,   200000,  true,  true,  5],
      ['claude-sonnet-4-5-20250929', 'Anthropic', 0.000003,   0.000015,   200000,  true,  true,  4],
      ['claude-sonnet-4-20250514',   'Anthropic', 0.000003,   0.000015,   200000,  true,  true,  4],
      ['claude-haiku-4-5-20251001',  'Anthropic', 0.000001,   0.000005,   200000,  false, true,  2],
      // OpenAI GPT
      ['gpt-4o',                     'OpenAI',    0.0000025,  0.00001,    128000,  false, true,  3],
      ['gpt-4o-mini',                'OpenAI',    0.00000015, 0.0000006,  128000,  false, true,  2],
      ['gpt-4.1',                    'OpenAI',    0.000002,   0.000008,   1047576, false, true,  5],
      ['gpt-4.1-mini',               'OpenAI',    0.0000004,  0.0000016,  1047576, false, true,  2],
      ['gpt-4.1-nano',               'OpenAI',    0.0000001,  0.0000004,  1047576, false, false, 1],
      // OpenAI reasoning
      ['o3',                         'OpenAI',    0.000002,   0.000008,   200000,  true,  true,  5],
      ['o3-mini',                    'OpenAI',    0.0000011,  0.0000044,  200000,  true,  true,  3],
      ['o4-mini',                    'OpenAI',    0.0000011,  0.0000044,  200000,  true,  true,  3],
      // OpenAI GPT-5.3
      ['gpt-5.3',                    'OpenAI',    0.00001,    0.00003,    128000,  false, true,  5],
      ['gpt-5.3-codex',              'OpenAI',    0.00001,    0.00003,    128000,  false, true,  5],
      ['gpt-5.3-mini',               'OpenAI',    0.0000015,  0.000006,   128000,  false, true,  2],
      // Google Gemini
      ['gemini-2.5-pro',             'Google',    0.00000125, 0.00001,    1048576, true,  true,  5],
      ['gemini-2.5-flash',           'Google',    0.00000015, 0.0000006,  1048576, false, true,  2],
      ['gemini-2.5-flash-lite',      'Google',    0.0000001,  0.0000004,  1048576, false, false, 1],
      ['gemini-2.0-flash',           'Google',    0.0000001,  0.0000004,  1048576, false, true,  2],
      // DeepSeek
      ['deepseek-v3',                'DeepSeek',  0.00000014, 0.00000028, 128000,  false, true,  2],
      ['deepseek-r1',                'DeepSeek',  0.00000055, 0.00000219, 128000,  true,  false, 4],
      // Moonshot (Kimi)
      ['kimi-k2',                    'Moonshot',  0.0000006,  0.0000024,  262144,  true,  true,  3],
      // Alibaba (Qwen)
      ['qwen-2.5-72b-instruct',      'Alibaba',  0.00000034, 0.00000039, 131072,  false, true,  2],
      ['qwq-32b',                    'Alibaba',   0.00000012, 0.00000018, 131072,  true,  false, 1],
      ['qwen-2.5-coder-32b-instruct','Alibaba',   0.00000018, 0.00000018, 131072,  false, true,  2],
      ['qwen3-235b-a22b',            'Alibaba',   0.0000003,  0.0000012,  131072,  true,  true,  3],
      ['qwen3-32b',                  'Alibaba',   0.0000001,  0.0000003,  131072,  false, true,  2],
      // Mistral
      ['mistral-large',              'Mistral',   0.000002,   0.000006,   128000,  false, true,  3],
      ['mistral-small',              'Mistral',   0.0000002,  0.0000006,  128000,  false, false, 1],
      ['codestral',                  'Mistral',   0.0000003,  0.0000009,  256000,  false, true,  2],
      // Zhipu (GLM)
      ['glm-4-plus',                 'Zhipu',     0.0000005,  0.0000005,  128000,  false, true,  2],
      ['glm-4-flash',                'Zhipu',     0.00000005, 0.00000005, 128000,  false, false, 1],
      // Amazon Nova
      ['nova-pro',                   'Amazon',    0.0000008,  0.0000032,  300000,  false, true,  3],
      ['nova-lite',                  'Amazon',    0.00000006, 0.00000024, 300000,  false, true,  2],
      ['nova-micro',                 'Amazon',    0.000000035,0.00000014, 128000,  false, false, 1],
      // xAI (Grok)
      ['grok-3',                     'xAI',       0.000003,   0.000015,   131072,  true,  true,  5],
      ['grok-3-mini',                'xAI',       0.0000003,  0.0000005,  131072,  true,  true,  3],
      ['grok-3-fast',                'xAI',       0.000005,   0.000025,   131072,  false, true,  4],
      ['grok-3-mini-fast',           'xAI',       0.0000006,  0.000004,   131072,  false, true,  2],
      ['grok-2',                     'xAI',       0.000002,   0.00001,    131072,  false, true,  3],
    ];

    for (const [name, provider, inputPrice, outputPrice, ctxWindow, reasoning, code, quality] of models) {
      await this.pricingRepo.upsert(
        {
          model_name: name,
          provider,
          input_price_per_token: inputPrice,
          output_price_per_token: outputPrice,
          context_window: ctxWindow,
          capability_reasoning: reasoning,
          capability_code: code,
          quality_score: quality,
        },
        ['model_name'],
      );
    }
    this.logger.log('Seeded model pricing data');
  }

  private async seedSecurityEvents() {
    const count = await this.securityRepo.count();
    if (count > 0) return;

    const userId = await this.getAdminUserId();

    const now = Date.now();
    const events = [
      ['sec-001', 'sess-001', -2, 'critical', 'unauthorized_access', 'Unauthorized API key attempt from unknown IP'],
      ['sec-002', 'sess-002', -3, 'warning', 'rate_limit', 'Rate limit exceeded for agent — 150 req/min threshold'],
      ['sec-003', 'sess-003', -5, 'info', 'config_change', 'Alert rule "High cost threshold" updated by admin'],
      ['sec-004', 'sess-004', -6, 'warning', 'sandbox_escape', 'Sandbox escape attempt detected in agent session'],
      ['sec-005', 'sess-005', -8, 'critical', 'data_exfiltration', 'Suspicious outbound data transfer detected'],
      ['sec-006', 'sess-006', -10, 'info', 'login', 'New login from device'],
      ['sec-007', 'sess-007', -12, 'warning', 'permission_escalation', 'Agent requested elevated permissions outside scope'],
      ['sec-008', 'sess-008', -14, 'info', 'api_key_rotation', 'API key rotated for production environment'],
      ['sec-009', 'sess-009', -18, 'critical', 'injection_attempt', 'Prompt injection attempt detected in agent input'],
      ['sec-010', 'sess-010', -22, 'warning', 'token_anomaly', 'Unusual token consumption spike: 340% above baseline'],
      ['sec-011', 'sess-011', -24, 'info', 'audit', 'Weekly security audit completed — 3 findings resolved'],
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
}
