import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInstanceCredential1800400000000 implements MigrationInterface {
  name = 'AddInstanceCredential1800400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "instance_credential" (
        "id" varchar NOT NULL,
        "instance_id" varchar NOT NULL,
        "secret_encrypted" text NOT NULL,
        "registered_at" timestamp NOT NULL,
        "schema_version" smallint NOT NULL DEFAULT 1,
        CONSTRAINT "PK_instance_credential" PRIMARY KEY ("id")
      )`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "instance_credential"`);
  }
}
