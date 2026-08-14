import { QueryRunner } from 'typeorm';
import { AddDashboardIndexes1772905146384 } from './1772905146384-AddDashboardIndexes';

describe('AddDashboardIndexes1772905146384', () => {
  let migration: AddDashboardIndexes1772905146384;
  let queryRunner: jest.Mocked<Pick<QueryRunner, 'query'>>;

  beforeEach(() => {
    migration = new AddDashboardIndexes1772905146384();
    queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
  });

  describe('up', () => {
    it('should create all 6 indexes', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);

      expect(queryRunner.query).toHaveBeenCalledTimes(6);
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('IDX_agent_messages_tenant_timestamp'),
      );
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('IDX_agent_messages_tenant_trace'),
      );
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('IDX_notification_rules_user_agent'),
      );
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('IDX_notification_rules_tenant_agent'),
      );
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('IDX_agent_messages_tenant_model'),
      );
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('IDX_agent_messages_tenant_agent_status'),
      );
    });

    it('should use CREATE INDEX IF NOT EXISTS', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);

      for (const call of queryRunner.query.mock.calls) {
        expect(call[0]).toMatch(/^CREATE INDEX IF NOT EXISTS/);
      }
    });
  });

  describe('down', () => {
    it('should drop all 6 indexes', async () => {
      await migration.down(queryRunner as unknown as QueryRunner);

      expect(queryRunner.query).toHaveBeenCalledTimes(6);
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('IDX_agent_messages_tenant_agent_status'),
      );
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('IDX_agent_messages_tenant_model'),
      );
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('IDX_notification_rules_tenant_agent'),
      );
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('IDX_notification_rules_user_agent'),
      );
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('IDX_agent_messages_tenant_trace'),
      );
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('IDX_agent_messages_tenant_timestamp'),
      );
    });

    it('should use DROP INDEX IF EXISTS', async () => {
      await migration.down(queryRunner as unknown as QueryRunner);

      for (const call of queryRunner.query.mock.calls) {
        expect(call[0]).toMatch(/^DROP INDEX IF EXISTS/);
      }
    });
  });
});
