import { MigrationInterface, QueryRunner } from 'typeorm';

const CURATED_MODELS = [
  'claude-opus-4-6',
  'claude-sonnet-4-6',
  'claude-sonnet-4-5-20250929',
  'claude-opus-4-5-20251101',
  'claude-opus-4-1-20250805',
  'claude-sonnet-4-20250514',
  'claude-opus-4-20250514',
  'claude-haiku-4-5-20251001',
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-4.1',
  'gpt-4.1-mini',
  'gpt-4.1-nano',
  'o3',
  'o3-mini',
  'o4-mini',
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
  'deepseek-chat',
  'deepseek-reasoner',
  'kimi-k2',
  'qwen-2.5-72b-instruct',
  'qwq-32b',
  'qwen-2.5-coder-32b-instruct',
  'qwen3-235b-a22b',
  'qwen3-32b',
  'mistral-large-latest',
  'mistral-small',
  'codestral-latest',
  'grok-3',
  'grok-3-mini',
  'grok-3-fast',
  'grok-3-mini-fast',
  'openrouter/auto',
  'anthropic/claude-opus-4-6',
  'anthropic/claude-sonnet-4-5',
  'openai/gpt-4o',
  'openai/o3',
  'google/gemini-2.5-pro',
  'google/gemini-2.5-flash',
  'deepseek/deepseek-r1',
  'deepseek/deepseek-chat-v3-0324',
  'meta-llama/llama-4-maverick',
  'mistralai/mistral-large',
  'x-ai/grok-3',
  'openrouter/free',
  'minimax/minimax-m2.5',
  'minimax/minimax-m1',
  'minimax-m2.7',
  'minimax-m2.7-highspeed',
  'minimax-m2.5',
  'minimax-m2.5-highspeed',
  'minimax-m2.1',
  'minimax-m2.1-highspeed',
  'minimax-m2',
  'minimax-m1',
  'glm-5',
  'glm-4.7',
  'glm-4.7-flash',
  'glm-4.6',
  'glm-4.6v',
  'glm-4.5',
  'glm-4.5-air',
  'glm-4.5-flash',
  'z-ai/glm-5',
  'z-ai/glm-4.7',
  'glm-4-plus',
  'glm-4-flash',
];

export class PurgeNonCuratedModels1772960000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const placeholders = CURATED_MODELS.map((_, i) => `$${i + 1}`).join(', ');
    await queryRunner.query(
      `DELETE FROM model_pricing
       WHERE model_name NOT IN (${placeholders})
         AND provider != 'Ollama'
         AND model_name NOT LIKE 'custom:%'`,
      CURATED_MODELS,
    );
  }

  public async down(): Promise<void> {
    // No-op: seeder re-creates curated models on next startup
  }
}
