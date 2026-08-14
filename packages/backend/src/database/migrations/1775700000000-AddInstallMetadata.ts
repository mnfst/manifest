import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInstallMetadata1775700000000 implements MigrationInterface {
  name = 'AddInstallMetadata1775700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "install_metadata" (
        "id" varchar NOT NULL,
        "install_id" varchar NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT NOW(),
        "first_send_at" timestamp DEFAULT NULL,
        "last_sent_at" timestamp DEFAULT NULL,
        CONSTRAINT "PK_install_metadata" PRIMARY KEY ("id")
      )`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "install_metadata"`);
  }
}
