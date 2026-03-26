import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropSecurityEventTable1773700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "security_event"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "security_event" (
        "id" varchar PRIMARY KEY NOT NULL,
        "session_key" varchar,
        "timestamp" timestamp NOT NULL,
        "severity" varchar NOT NULL,
        "category" varchar NOT NULL,
        "description" varchar NOT NULL,
        "user_id" varchar
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_security_event_user_timestamp" ON "security_event" ("user_id", "timestamp")`,
    );
  }
}
