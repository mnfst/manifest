import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Renames `agents.is_system` to `agents.is_playground`. The flag only ever
 * marked the reserved per-tenant "Playground" agent, so the old name was
 * ambiguous (nothing else about the agent is "system"-level). The rename is
 * guarded so it is a no-op on databases that already have the new column.
 */
export class RenameIsSystemToIsPlayground1791800000000 implements MigrationInterface {
  name = 'RenameIsSystemToIsPlayground1791800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DO $$ BEGIN
         IF EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_name = 'agents' AND column_name = 'is_system'
         ) THEN
           ALTER TABLE "agents" RENAME COLUMN "is_system" TO "is_playground";
         END IF;
       END $$`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DO $$ BEGIN
         IF EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_name = 'agents' AND column_name = 'is_playground'
         ) THEN
           ALTER TABLE "agents" RENAME COLUMN "is_playground" TO "is_system";
         END IF;
       END $$`,
    );
  }
}
