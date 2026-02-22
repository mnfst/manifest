import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedQualityScores1771800100000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 5=frontier, 4=tier-1.5, 3=mid-range, 2=cost-optimized, 1=ultra-low-cost
    const scores: [string, number][] = [
      // Anthropic
      ['claude-opus-4-6', 5],
      ['claude-sonnet-4-5-20250929', 4],
      ['claude-sonnet-4-20250514', 4],
      ['claude-haiku-4-5-20251001', 2],
      // OpenAI
      ['gpt-4.1', 5],
      ['gpt-4o', 3],
      ['gpt-4o-mini', 2],
      ['gpt-4.1-mini', 2],
      ['gpt-4.1-nano', 1],
      ['o3', 5],
      ['o3-mini', 3],
      ['o4-mini', 3],
      // Google
      ['gemini-2.5-pro', 5],
      ['gemini-2.5-flash', 2],
      ['gemini-2.5-flash-lite', 1],
      ['gemini-2.0-flash', 2],
      // DeepSeek
      ['deepseek-v3', 2],
      ['deepseek-r1', 4],
      // Moonshot
      ['kimi-k2', 3],
      // Alibaba
      ['qwen-2.5-72b-instruct', 2],
      ['qwq-32b', 1],
      ['qwen-2.5-coder-32b-instruct', 2],
      // Mistral
      ['mistral-large', 3],
      ['mistral-small', 1],
      ['codestral', 2],
      // Meta
      ['llama-4-maverick', 3],
      ['llama-4-scout', 2],
      // Cohere
      ['command-r-plus', 3],
      ['command-r', 2],
    ];

    for (const [model, score] of scores) {
      await queryRunner.query(
        `UPDATE model_pricing SET quality_score = $1 WHERE model_name = $2`,
        [score, model],
      );
    }
  }

  public async down(): Promise<void> {
    // No rollback — quality_score column is dropped by the AddQualityScore migration
  }
}
