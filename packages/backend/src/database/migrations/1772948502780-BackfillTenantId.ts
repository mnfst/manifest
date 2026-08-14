import { MigrationInterface, QueryRunner } from 'typeorm';

export class BackfillTenantId1772948502780 implements MigrationInterface {
  name = 'BackfillTenantId1772948502780';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE agent_messages
      SET tenant_id = t.id
      FROM tenants t
      WHERE agent_messages.user_id = t.name
        AND agent_messages.tenant_id IS NULL
        AND agent_messages.user_id IS NOT NULL
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // no-op: cannot reliably determine which rows had NULL tenant_id before
  }
}
