import { QueryRunner } from 'typeorm';
import { BackfillTenantId1772948502780 } from './1772948502780-BackfillTenantId';

describe('BackfillTenantId1772948502780', () => {
  let migration: BackfillTenantId1772948502780;
  let queryRunner: jest.Mocked<Pick<QueryRunner, 'query'>>;

  beforeEach(() => {
    migration = new BackfillTenantId1772948502780();
    queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
  });

  describe('up', () => {
    it('should run the backfill UPDATE', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);

      expect(queryRunner.query).toHaveBeenCalledTimes(1);
    });

    it('should join agent_messages to tenants via user_id = name', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);

      const sql = queryRunner.query.mock.calls[0][0] as string;
      expect(sql).toContain('agent_messages.user_id = t.name');
    });

    it('should only update rows where tenant_id IS NULL', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);

      const sql = queryRunner.query.mock.calls[0][0] as string;
      expect(sql).toContain('agent_messages.tenant_id IS NULL');
    });

    it('should skip rows where user_id IS NULL', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);

      const sql = queryRunner.query.mock.calls[0][0] as string;
      expect(sql).toContain('agent_messages.user_id IS NOT NULL');
    });

    it('should set tenant_id from tenants table', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);

      const sql = queryRunner.query.mock.calls[0][0] as string;
      expect(sql).toContain('SET tenant_id = t.id');
      expect(sql).toContain('FROM tenants t');
    });
  });

  describe('down', () => {
    it('should be a no-op', async () => {
      await migration.down(queryRunner as unknown as QueryRunner);
    });
  });
});
