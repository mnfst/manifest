import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReAddComplexityRoutingFlag1781000000000 implements MigrationInterface {
  name = 'ReAddComplexityRoutingFlag1781000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add with DEFAULT true so existing agents keep complexity routing on.
    await queryRunner.query(
      `ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "complexity_routing_enabled" boolean NOT NULL DEFAULT true`,
    );
    // Change default to false so new agents start with simple routing.
    await queryRunner.query(
      `ALTER TABLE "agents" ALTER COLUMN "complexity_routing_enabled" SET DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "agents" DROP COLUMN IF EXISTS "complexity_routing_enabled"`,
    );
  }
}
