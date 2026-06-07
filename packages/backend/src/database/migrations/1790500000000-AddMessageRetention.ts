import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMessageRetention1790500000000 implements MigrationInterface {
	name = 'AddMessageRetention1790500000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE install_metadata ADD COLUMN message_retention_days integer DEFAULT NULL`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`ALTER TABLE install_metadata DROP COLUMN message_retention_days`);
	}
}
