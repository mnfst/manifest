import { Logger } from '@nestjs/common';
import { QueryRunner } from 'typeorm';
import { AddUserProviderIdToAgentMessages1792000000000 } from './1792000000000-AddUserProviderIdToAgentMessages';

describe('AddUserProviderIdToAgentMessages1792000000000', () => {
  let migration: AddUserProviderIdToAgentMessages1792000000000;
  let queries: string[];
  let queryRunner: jest.Mocked<Pick<QueryRunner, 'query'>>;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    migration = new AddUserProviderIdToAgentMessages1792000000000();
    queries = [];
    queryRunner = {
      query: jest.fn(async (sql: string): Promise<unknown> => {
        queries.push(sql);
        if (sql.includes('FILTER (WHERE user_provider_id IS NOT NULL)')) {
          return [{ matched: 7, remaining: 3 }];
        }
        return undefined;
      }) as unknown as jest.Mocked<Pick<QueryRunner, 'query'>>['query'],
    };
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  describe('up', () => {
    it('adds the nullable column first, with IF NOT EXISTS', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);

      expect(queries[0]).toContain(
        'ALTER TABLE "agent_messages" ADD COLUMN IF NOT EXISTS "user_provider_id" varchar',
      );
    });

    it('runs three separate backfill UPDATEs, each guarded by user_provider_id IS NULL so earlier stamps exclude rows from later passes', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);

      const updates = queries.filter((q) => q.includes('UPDATE "agent_messages" am'));
      expect(updates).toHaveLength(3);
      for (const update of updates) {
        expect(update).toContain('WHERE am2.user_provider_id IS NULL');
        expect(update).toContain('AND am2.provider IS NOT NULL');
        expect(update).toContain('MIN(up.id) AS up_id');
        expect(update).toContain('GROUP BY am2.id');
        expect(update).toContain('HAVING COUNT(*) = 1');
        expect(update).toContain('WHERE am.id = m.msg_id');
      }
    });

    it('pass 1 anchors on the agent and matches the exact (provider, auth_type, label) tuple', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);

      const pass1 = queries.filter((q) => q.includes('UPDATE "agent_messages" am'))[0];
      expect(pass1).toContain('ON up.agent_id = am2.agent_id');
      expect(pass1).toContain('LOWER(up.provider) = LOWER(am2.provider)');
      expect(pass1).toContain('up.auth_type = am2.auth_type');
      expect(pass1).toContain(
        `LOWER(up.label) = LOWER(COALESCE(am2.provider_key_label, 'Default'))`,
      );
      expect(pass1).toContain('AND am2.agent_id IS NOT NULL');
      // Agent-anchored: must not detour through tenants.
      expect(pass1).not.toContain('JOIN "tenants"');
    });

    it('pass 2 anchors on the agent but ignores the label (covers lift-relabeled rows)', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);

      const pass2 = queries.filter((q) => q.includes('UPDATE "agent_messages" am'))[1];
      expect(pass2).toContain('ON up.agent_id = am2.agent_id');
      expect(pass2).toContain('LOWER(up.provider) = LOWER(am2.provider)');
      expect(pass2).toContain('up.auth_type = am2.auth_type');
      expect(pass2).toContain('AND am2.agent_id IS NOT NULL');
      expect(pass2).not.toContain('provider_key_label');
      expect(pass2).not.toContain('up.label');
      expect(pass2).not.toContain('JOIN "tenants"');
    });

    it('pass 3 keeps the user-level label match via tenants for deleted-agent / NULL agent_id messages', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);

      const pass3 = queries.filter((q) => q.includes('UPDATE "agent_messages" am'))[2];
      expect(pass3).toContain('JOIN "tenants" t ON t.id = am2.tenant_id');
      expect(pass3).toContain('ON up.user_id = t.name');
      expect(pass3).toContain('LOWER(up.provider) = LOWER(am2.provider)');
      expect(pass3).toContain('up.auth_type = am2.auth_type');
      expect(pass3).toContain(
        `LOWER(up.label) = LOWER(COALESCE(am2.provider_key_label, 'Default'))`,
      );
      // User-level: must not require an agent anchor.
      expect(pass3).not.toContain('up.agent_id = am2.agent_id');
      expect(pass3).not.toContain('am2.agent_id IS NOT NULL');
    });

    it('logs the backfill outcome with matched/remaining counts and the pass summary', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);

      const countSql = queries.find((q) =>
        q.includes('FILTER (WHERE user_provider_id IS NOT NULL)'),
      );
      expect(countSql).toBeDefined();
      expect(countSql).toContain('FILTER (WHERE user_provider_id IS NULL)');
      expect(logSpy).toHaveBeenCalledTimes(1);
      const message = logSpy.mock.calls[0][0] as string;
      expect(message).toContain('Backfilled user_provider_id on 7 message(s)');
      expect(message).toContain('three passes');
      expect(message).toContain('agent-exact label, agent-unique key, user-level label');
      expect(message).toContain('3 left NULL');
    });

    it('adds the FK with ON DELETE SET NULL and the covering index, after the backfill', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);

      const fkIdx = queries.findIndex((q) =>
        q.includes('ADD CONSTRAINT "FK_agent_messages_user_provider"'),
      );
      const indexIdx = queries.findIndex((q) =>
        q.includes('CREATE INDEX "IDX_agent_messages_user_provider"'),
      );
      const lastUpdateIdx = queries
        .map((q, i) => (q.includes('UPDATE "agent_messages" am') ? i : -1))
        .filter((i) => i >= 0)
        .pop() as number;

      expect(queries[fkIdx]).toContain(
        'FOREIGN KEY ("user_provider_id") REFERENCES "user_providers"("id")',
      );
      expect(queries[fkIdx]).toContain('ON DELETE SET NULL ON UPDATE NO ACTION');
      expect(queries[indexIdx]).toContain('("user_provider_id", "tenant_id", "timestamp" DESC)');
      expect(fkIdx).toBeGreaterThan(lastUpdateIdx);
      expect(indexIdx).toBeGreaterThan(fkIdx);
    });
  });

  describe('down', () => {
    it('drops the index, then the FK, then the column', async () => {
      await migration.down(queryRunner as unknown as QueryRunner);

      expect(queries).toHaveLength(3);
      expect(queries[0]).toContain('DROP INDEX IF EXISTS "IDX_agent_messages_user_provider"');
      expect(queries[1]).toContain('DROP CONSTRAINT IF EXISTS "FK_agent_messages_user_provider"');
      expect(queries[2]).toContain('DROP COLUMN IF EXISTS "user_provider_id"');
    });
  });
});
