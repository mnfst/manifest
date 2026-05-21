import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add the missing FK from `agent_model_params.agent_id` → `agents.id` with
 * ON DELETE CASCADE. The routing-config family (this table plus
 * tier/specificity/header assignments) historically used logical references
 * only, unlike `agent_api_keys` / `custom_providers` which already cascade.
 *
 * Soft delete (the normal `DELETE /agents/:name` path) sets `agents.deleted_at`
 * and leaves the row, so this constraint never fires there — saved params are
 * retained. It only fires on a genuine row delete (e.g. a future tenant/account
 * purge cascading through `agents.tenant_id → tenants.id`), preventing orphans.
 */
export class AddAgentModelParamsAgentFk1789300000000 implements MigrationInterface {
  name = 'AddAgentModelParamsAgentFk1789300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop any pre-existing orphans so ADD CONSTRAINT can validate. Soft-deleted
    // agents keep their row, so their params survive — only rows pointing at a
    // truly absent agent are removed.
    await queryRunner.query(
      `DELETE FROM "agent_model_params" WHERE "agent_id" NOT IN (SELECT "id" FROM "agents")`,
    );
    await queryRunner.query(
      `ALTER TABLE "agent_model_params" ADD CONSTRAINT "FK_agent_model_params_agent" ` +
        `FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "agent_model_params" DROP CONSTRAINT "FK_agent_model_params_agent"`,
    );
  }
}
