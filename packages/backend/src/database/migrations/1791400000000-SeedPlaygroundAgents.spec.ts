import { SeedPlaygroundAgents1791400000000 } from './1791400000000-SeedPlaygroundAgents';

describe('SeedPlaygroundAgents1791400000000', () => {
  const migration = new SeedPlaygroundAgents1791400000000();
  const queries: Array<{ sql: string; params?: unknown[] }> = [];
  const queryRunner = {
    query: jest.fn(async (sql: string, params?: unknown[]) => queries.push({ sql, params })),
  } as never;

  beforeEach(() => {
    queries.length = 0;
    (queryRunner as { query: jest.Mock }).query.mockClear();
  });

  describe('up()', () => {
    it('adds the is_system column before any INSERT', async () => {
      await migration.up(queryRunner);
      const addColIdx = queries.findIndex(
        (q) => q.sql.includes('ADD COLUMN IF NOT EXISTS') && q.sql.includes('"is_system"'),
      );
      const insertIdx = queries.findIndex((q) => q.sql.trimStart().startsWith('INSERT INTO'));
      expect(addColIdx).toBeGreaterThanOrEqual(0);
      expect(insertIdx).toBeGreaterThan(addColIdx);
    });

    it("uses slug-safe name suffix `name || '-' || id` (no spaces or brackets)", async () => {
      await migration.up(queryRunner);
      const relabel = queries.find(
        (q) => q.sql.includes('UPDATE') && q.sql.includes('"is_system"'),
      );
      expect(relabel).toBeDefined();
      // Must contain `-` concatenation, not space/bracket form
      expect(relabel!.sql).toContain('"name" || \'-\' || "id"');
      // Must NOT contain the old space-bracket form
      expect(relabel!.sql).not.toContain("' ['");
    });

    it('relabels BEFORE inserting the reserved agent (so unique index never collides)', async () => {
      await migration.up(queryRunner);
      const relabelIdx = queries.findIndex(
        (q) => q.sql.includes('UPDATE') && q.sql.includes('"is_system"'),
      );
      const insertIdx = queries.findIndex(
        (q) => q.sql.includes('INSERT INTO "agents"') && q.sql.includes('gen_random_uuid'),
      );
      expect(relabelIdx).toBeGreaterThanOrEqual(0);
      expect(insertIdx).toBeGreaterThan(relabelIdx);
    });

    it('only relabels non-system agents that are not soft-deleted', async () => {
      await migration.up(queryRunner);
      const relabel = queries.find(
        (q) => q.sql.includes('UPDATE') && q.sql.includes('"is_system"'),
      );
      expect(relabel).toBeDefined();
      expect(relabel!.sql).toContain('"is_system" = false');
      expect(relabel!.sql).toContain('"deleted_at" IS NULL');
    });

    it('creates a reserved Playground agent per tenant that lacks one (INSERT ... WHERE NOT EXISTS)', async () => {
      await migration.up(queryRunner);
      const insert = queries.find(
        (q) => q.sql.includes('INSERT INTO "agents"') && q.sql.includes('NOT EXISTS'),
      );
      expect(insert).toBeDefined();
      expect(insert!.sql).toContain('"is_system"');
      expect(insert!.sql).toContain('gen_random_uuid');
    });

    it('grants the Playground agent its tenant provider pool (ON CONFLICT DO NOTHING)', async () => {
      await migration.up(queryRunner);
      const grant = queries.find(
        (q) =>
          q.sql.includes('INSERT INTO "agent_provider_access"') &&
          q.sql.includes('ON CONFLICT DO NOTHING'),
      );
      expect(grant).toBeDefined();
      expect(grant!.sql).toContain('"is_system" = true');
    });
  });

  describe('down()', () => {
    it('removes system agents and drops the is_system column', async () => {
      await migration.down(queryRunner);
      const deleteAgents = queries.find(
        (q) => q.sql.includes('DELETE FROM "agents"') && q.sql.includes('"is_system"'),
      );
      expect(deleteAgents).toBeDefined();
      const dropCol = queries.find(
        (q) => q.sql.includes('DROP COLUMN IF EXISTS') && q.sql.includes('"is_system"'),
      );
      expect(dropCol).toBeDefined();
    });
  });
});
