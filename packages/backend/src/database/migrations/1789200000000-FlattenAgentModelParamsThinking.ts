import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Store model params as UI values instead of provider wire shapes. DeepSeek
 * thinking rows previously stored `{ thinking: { type: "enabled" } }`; the
 * registry now stores `{ thinking: "enabled" }` and handles wire transforms
 * only during outbound request merging.
 */
export class FlattenAgentModelParamsThinking1789200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE agent_model_params
      SET params = jsonb_set(params - 'thinking', '{thinking}', params->'thinking'->'type')
      WHERE params ? 'thinking'
        AND jsonb_typeof(params->'thinking') = 'object'
        AND params->'thinking' ? 'type'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE agent_model_params
      SET params = jsonb_set(
        params - 'thinking',
        '{thinking}',
        jsonb_build_object('type', params->'thinking')
      )
      WHERE params ? 'thinking'
        AND jsonb_typeof(params->'thinking') = 'string'
    `);
  }
}
