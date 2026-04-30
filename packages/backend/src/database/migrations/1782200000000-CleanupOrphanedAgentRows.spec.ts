import { QueryRunner } from 'typeorm';
import { CleanupOrphanedAgentRows1782200000000 } from './1782200000000-CleanupOrphanedAgentRows';

describe('CleanupOrphanedAgentRows1782200000000', () => {
  let migration: CleanupOrphanedAgentRows1782200000000;
  let queryRunner: jest.Mocked<Pick<QueryRunner, 'query'>>;

  beforeEach(() => {
    migration = new CleanupOrphanedAgentRows1782200000000();
    queryRunner = {
      query: jest.fn().mockImplementation(async (sql: string, params?: unknown[]) => {
        if (typeof sql === 'string' && sql.includes('to_regclass')) {
          return [{ reg: params?.[0] }];
        }
        return undefined;
      }),
    };
  });

  describe('up', () => {
    it('deletes orphan rows from each agent_id-keyed table and notification_logs', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);

      const sqls = queryRunner.query.mock.calls.map((c) => c[0] as string);

      const expectedTables = [
        'agent_messages',
        'agent_logs',
        'cost_snapshots',
        'token_usage_snapshots',
        'tier_assignments',
        'specificity_assignments',
        'header_tiers',
        'user_providers',
        'llm_calls',
        'tool_executions',
        'notification_rules',
      ];

      for (const table of expectedTables) {
        const sql = sqls.find((s) => s.includes(`FROM "${table}"`) && s.includes('NOT EXISTS'));
        expect(sql).toBeDefined();
        expect(sql).toContain('agent_id IS NOT NULL');
        expect(sql).toContain('NOT EXISTS (SELECT 1 FROM "agents"');
      }

      const logsSql = sqls.find((s) => s.includes('FROM "notification_logs"'));
      expect(logsSql).toBeDefined();
      expect(logsSql).toContain('rule_id IS NOT NULL');
      expect(logsSql).toContain('"notification_rules"');
    });

    it('skips optional snapshot tables when they are absent from the schema', async () => {
      queryRunner.query = jest.fn().mockImplementation(async (sql: string) => {
        if (typeof sql === 'string' && sql.includes('to_regclass')) {
          return [{ reg: null }];
        }
        return undefined;
      });

      await migration.up(queryRunner as unknown as QueryRunner);

      const sqls = queryRunner.query.mock.calls.map((c) => c[0] as string);
      expect(sqls.find((s) => s.includes('FROM "cost_snapshots"'))).toBeUndefined();
      expect(sqls.find((s) => s.includes('FROM "token_usage_snapshots"'))).toBeUndefined();
      // Mandatory tables and notification_logs still run.
      expect(sqls.find((s) => s.includes('FROM "agent_messages"'))).toBeDefined();
      expect(sqls.find((s) => s.includes('FROM "notification_logs"'))).toBeDefined();
    });
  });

  describe('down', () => {
    it('is a no-op', async () => {
      await migration.down();
      expect(queryRunner.query).not.toHaveBeenCalled();
    });
  });
});
