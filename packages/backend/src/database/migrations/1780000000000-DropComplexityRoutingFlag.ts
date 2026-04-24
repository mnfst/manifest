import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropComplexityRoutingFlag1780000000000 implements MigrationInterface {
  name = 'DropComplexityRoutingFlag1780000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "agents" DROP COLUMN "complexity_routing_enabled"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restore the column as always-on so rollbacks match the always-on
    // product semantic (the original 1777100000000 migration added the
    // column with DEFAULT false and then UPDATEd existing rows to true;
    // repeating that dance on rollback would flip new agents back to off).
    await queryRunner.query(
      `ALTER TABLE "agents" ADD COLUMN "complexity_routing_enabled" boolean NOT NULL DEFAULT true`,
    );
  }
}
