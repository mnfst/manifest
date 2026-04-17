import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { auth } from '../auth/auth.instance';
import { Tenant } from '../entities/tenant.entity';
import { Agent } from '../entities/agent.entity';
import { AgentApiKey } from '../entities/agent-api-key.entity';
import { ApiKey } from '../entities/api-key.entity';
import { AgentMessage } from '../entities/agent-message.entity';
import { hashKey, keyPrefix } from '../common/utils/hash.util';
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
    @InjectRepository(AgentMessage) private readonly messageRepo: Repository<AgentMessage>,
  ) {}

  async onModuleInit() {
    await this.runBetterAuthMigrations();

    const seedData = this.configService.get<string>('SEED_DATA');
    if (seedData !== 'true') return;

    const nodeEnv = this.configService.get<string>('app.nodeEnv', 'development');
    if (nodeEnv === 'production') {
      this.logger.warn(
        'SEED_DATA=true is ignored in production — use the first-run setup wizard at /setup to create the admin account. Demo data is not seeded in production.',
      );
      return;
    }

    // Dev/test workflow: seed the well-known admin + demo data in one shot
    // so `/serve` and E2E tests get a non-empty dashboard without going
    // through the setup wizard on every run.
    await this.seedAdminUser();
    await this.seedApiKey();
    await this.seedTenantAndAgent();
    await this.seedAgentMessages();
    this.logger.log('Seeded demo data (SEED_DATA=true, dev/test only)');
    this.logger.warn(
      'SECURITY: Default seed credentials are active (admin@manifest.build). Do NOT use in production.',
    );
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
      agent_category: 'personal',
      agent_platform: 'openclaw',
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

  private async seedAgentMessages() {
    const userId = await this.getAdminUserId();
    if (!userId) return;
    await seedAgentMessages(this.messageRepo, userId, this.logger);
  }
}
