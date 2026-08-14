import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAgentDisplayName1772400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE agents ADD COLUMN display_name varchar`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE agents DROP COLUMN display_name`);
  }
}
