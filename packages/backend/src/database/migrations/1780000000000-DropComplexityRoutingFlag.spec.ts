import { QueryRunner } from 'typeorm';
import { DropComplexityRoutingFlag1780000000000 } from './1780000000000-DropComplexityRoutingFlag';

describe('DropComplexityRoutingFlag1780000000000', () => {
  let migration: DropComplexityRoutingFlag1780000000000;
  let queryRunner: jest.Mocked<Pick<QueryRunner, 'query'>>;

  beforeEach(() => {
    migration = new DropComplexityRoutingFlag1780000000000();
    queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
  });

  it('exposes a stable migration name', () => {
    expect(migration.name).toBe('DropComplexityRoutingFlag1780000000000');
  });

  describe('up', () => {
    it('drops the complexity_routing_enabled column idempotently', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);

      const sqls = queryRunner.query.mock.calls.map((c) => c[0] as string);
      expect(sqls).toHaveLength(1);
      expect(sqls[0]).toContain(
        'ALTER TABLE "agents" DROP COLUMN IF EXISTS "complexity_routing_enabled"',
      );
    });
  });

  describe('down', () => {
    it('restores the column idempotently with DEFAULT true (always-on semantic)', async () => {
      await migration.down(queryRunner as unknown as QueryRunner);

      const sqls = queryRunner.query.mock.calls.map((c) => c[0] as string);
      expect(sqls).toHaveLength(1);
      expect(sqls[0]).toContain('ALTER TABLE "agents"');
      expect(sqls[0]).toContain('ADD COLUMN IF NOT EXISTS "complexity_routing_enabled"');
      expect(sqls[0]).toContain('boolean NOT NULL DEFAULT true');
    });
  });
});
