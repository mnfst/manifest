import { QueryRunner } from 'typeorm';
import { PurgeNonCuratedModels1772960000000 } from './1772960000000-PurgeNonCuratedModels';

describe('PurgeNonCuratedModels1772960000000', () => {
  let migration: PurgeNonCuratedModels1772960000000;
  let queryRunner: jest.Mocked<Pick<QueryRunner, 'query'>>;

  beforeEach(() => {
    migration = new PurgeNonCuratedModels1772960000000();
    queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
  });

  describe('up', () => {
    it('should execute a single DELETE query', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);

      expect(queryRunner.query).toHaveBeenCalledTimes(1);
    });

    it('should delete non-curated models while preserving curated ones', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);

      const sql = queryRunner.query.mock.calls[0][0] as string;
      expect(sql).toContain('DELETE FROM model_pricing');
      expect(sql).toContain('NOT IN');
    });

    it('should exclude Ollama models from deletion', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);

      const sql = queryRunner.query.mock.calls[0][0] as string;
      expect(sql).toContain("provider != 'Ollama'");
    });

    it('should exclude custom provider models from deletion', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);

      const sql = queryRunner.query.mock.calls[0][0] as string;
      expect(sql).toContain("model_name NOT LIKE 'custom:%'");
    });

    it('should pass curated model names as parameterized values', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);

      const params = queryRunner.query.mock.calls[0][1] as string[];
      expect(params).toContain('claude-opus-4-6');
      expect(params).toContain('gpt-4o');
      expect(params).toContain('openrouter/auto');
      expect(params).toContain('glm-4-flash');
      expect(params).toContain('minimax-m2.7');
      expect(params).toContain('minimax-m2.7-highspeed');
      expect(params.length).toBe(70);
    });
  });

  describe('down', () => {
    it('should be a no-op', async () => {
      await migration.down();

      expect(queryRunner.query).not.toHaveBeenCalled();
    });
  });
});
