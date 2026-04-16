import { QueryRunner } from 'typeorm';
import { AddMessageFeedback1775600000000 } from './1775600000000-AddMessageFeedback';

describe('AddMessageFeedback1775600000000', () => {
  let migration: AddMessageFeedback1775600000000;
  let queryRunner: jest.Mocked<Pick<QueryRunner, 'query'>>;

  beforeEach(() => {
    migration = new AddMessageFeedback1775600000000();
    queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
  });

  describe('up', () => {
    it('should add feedback_rating, feedback_tags, and feedback_details columns', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);

      expect(queryRunner.query).toHaveBeenCalledTimes(3);
      expect(queryRunner.query).toHaveBeenCalledWith(expect.stringContaining('"feedback_rating"'));
      expect(queryRunner.query).toHaveBeenCalledWith(expect.stringContaining('"feedback_tags"'));
      expect(queryRunner.query).toHaveBeenCalledWith(expect.stringContaining('"feedback_details"'));
    });

    it('should create nullable columns on agent_messages', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);

      for (const call of queryRunner.query.mock.calls) {
        const sql = call[0] as string;
        expect(sql).toContain('ALTER TABLE "agent_messages"');
        expect(sql).toContain('ADD COLUMN');
        expect(sql).toContain('DEFAULT NULL');
      }
    });

    it('should create feedback_rating and feedback_tags as varchar', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);

      const ratingSQL = queryRunner.query.mock.calls[0][0] as string;
      expect(ratingSQL).toContain('varchar');

      const tagsSQL = queryRunner.query.mock.calls[1][0] as string;
      expect(tagsSQL).toContain('varchar');
    });

    it('should create feedback_details as text', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);

      const detailsSQL = queryRunner.query.mock.calls[2][0] as string;
      expect(detailsSQL).toContain('text');
    });
  });

  describe('down', () => {
    it('should drop all three feedback columns', async () => {
      await migration.down(queryRunner as unknown as QueryRunner);

      expect(queryRunner.query).toHaveBeenCalledTimes(3);
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('DROP COLUMN "feedback_details"'),
      );
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('DROP COLUMN "feedback_tags"'),
      );
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('DROP COLUMN "feedback_rating"'),
      );
    });
  });

  it('exposes a stable migration name', () => {
    expect(migration.name).toBe('AddMessageFeedback1775600000000');
  });
});
