import { QueryRunner } from 'typeorm';
import { RenameProviderAccessToEnabledProviders1791800000000 } from './1791800000000-RenameProviderAccessToEnabledProviders';

describe('RenameProviderAccessToEnabledProviders1791800000000', () => {
  let migration: RenameProviderAccessToEnabledProviders1791800000000;
  let queryRunner: jest.Mocked<Pick<QueryRunner, 'query'>>;

  beforeEach(() => {
    migration = new RenameProviderAccessToEnabledProviders1791800000000();
    queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
  });

  describe('up', () => {
    it('renames the table and its constraints/index to the enabled-providers names', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);

      expect(queryRunner.query).toHaveBeenCalledTimes(5);
      expect(queryRunner.query).toHaveBeenCalledWith(
        `ALTER TABLE "agent_provider_access" RENAME TO "agent_enabled_providers"`,
      );
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining(
          'RENAME CONSTRAINT "PK_agent_provider_access" TO "PK_agent_enabled_providers"',
        ),
      );
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining(
          'RENAME CONSTRAINT "FK_agent_provider_access_agent" TO "FK_agent_enabled_providers_agent"',
        ),
      );
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining(
          'RENAME CONSTRAINT "FK_agent_provider_access_provider" TO "FK_agent_enabled_providers_provider"',
        ),
      );
      expect(queryRunner.query).toHaveBeenCalledWith(
        `ALTER INDEX "IDX_agent_provider_access_provider" RENAME TO "IDX_agent_enabled_providers_provider"`,
      );
    });

    it('never issues DROP/DELETE/TRUNCATE — the rename must be data-preserving', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);

      for (const [sql] of queryRunner.query.mock.calls) {
        expect(sql).not.toMatch(/DROP|DELETE|TRUNCATE/i);
      }
    });
  });

  describe('down', () => {
    it('restores the original table, constraint, and index names', async () => {
      await migration.down(queryRunner as unknown as QueryRunner);

      expect(queryRunner.query).toHaveBeenCalledTimes(5);
      expect(queryRunner.query).toHaveBeenCalledWith(
        `ALTER TABLE "agent_enabled_providers" RENAME TO "agent_provider_access"`,
      );
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining(
          'RENAME CONSTRAINT "PK_agent_enabled_providers" TO "PK_agent_provider_access"',
        ),
      );
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining(
          'RENAME CONSTRAINT "FK_agent_enabled_providers_agent" TO "FK_agent_provider_access_agent"',
        ),
      );
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining(
          'RENAME CONSTRAINT "FK_agent_enabled_providers_provider" TO "FK_agent_provider_access_provider"',
        ),
      );
      expect(queryRunner.query).toHaveBeenCalledWith(
        `ALTER INDEX "IDX_agent_enabled_providers_provider" RENAME TO "IDX_agent_provider_access_provider"`,
      );
    });

    it('never issues DROP/DELETE/TRUNCATE — the revert must be data-preserving', async () => {
      await migration.down(queryRunner as unknown as QueryRunner);

      for (const [sql] of queryRunner.query.mock.calls) {
        expect(sql).not.toMatch(/DROP|DELETE|TRUNCATE/i);
      }
    });
  });
});
