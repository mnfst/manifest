import { computeQualityScore, QUALITY_OVERRIDES } from './quality-score.util';

function m(overrides: {
  model_name: string;
  input: number;
  output: number;
  reasoning?: boolean;
  code?: boolean;
  ctx?: number;
}) {
  return {
    model_name: overrides.model_name,
    input_price_per_token: overrides.input,
    output_price_per_token: overrides.output,
    capability_reasoning: overrides.reasoning ?? false,
    capability_code: overrides.code ?? false,
    context_window: overrides.ctx ?? 128000,
  };
}

describe('computeQualityScore', () => {
  describe('all seeded models', () => {
    const cases: Array<[string, number, number, boolean, boolean, number, number]> = [
      // [model_name, input/tok, output/tok, reasoning, code, ctx, expected_quality]
      // Anthropic
      ['claude-opus-4-6',            0.000015,   0.000075,   true,  true,  200000,  5],
      ['claude-sonnet-4-5-20250929', 0.000003,   0.000015,   true,  true,  200000,  4],
      ['claude-sonnet-4-20250514',   0.000003,   0.000015,   true,  true,  200000,  4],
      ['claude-haiku-4-5-20251001',  0.000001,   0.000005,   false, true,  200000,  2],
      // OpenAI GPT
      ['gpt-4o',                     0.0000025,  0.00001,    false, true,  128000,  3],
      ['gpt-4o-mini',                0.00000015, 0.0000006,  false, true,  128000,  2],
      ['gpt-4.1',                    0.000002,   0.000008,   false, true,  1047576, 5],
      ['gpt-4.1-mini',               0.0000004,  0.0000016,  false, true,  1047576, 2],
      ['gpt-4.1-nano',               0.0000001,  0.0000004,  false, false, 1047576, 1],
      // OpenAI reasoning
      ['o3',                         0.000002,   0.000008,   true,  true,  200000,  5],
      ['o3-mini',                    0.0000011,  0.0000044,  true,  true,  200000,  3],
      ['o4-mini',                    0.0000011,  0.0000044,  true,  true,  200000,  3],
      // OpenAI GPT-5.3
      ['gpt-5.3',                    0.00001,    0.00003,    true,  true,  200000,  5],
      ['gpt-5.3-codex',              0.00001,    0.00003,    true,  true,  200000,  5],
      ['gpt-5.3-mini',               0.0000015,  0.000006,   true,  true,  200000,  3],
      // Google Gemini
      ['gemini-2.5-pro',             0.00000125, 0.00001,    true,  true,  1048576, 5],
      ['gemini-2.5-flash',           0.00000015, 0.0000006,  false, true,  1048576, 2],
      ['gemini-2.5-flash-lite',      0.0000001,  0.0000004,  false, false, 1048576, 1],
      ['gemini-2.0-flash',           0.0000001,  0.0000004,  false, true,  1048576, 2],
      // DeepSeek
      ['deepseek-v3',                0.00000014, 0.00000028, false, true,  128000,  2],
      ['deepseek-r1',                0.00000055, 0.00000219, true,  false, 128000,  4],
      // Moonshot
      ['kimi-k2',                    0.0000006,  0.0000024,  true,  true,  262144,  3],
      // Alibaba
      ['qwen-2.5-72b-instruct',     0.00000034, 0.00000039, false, true,  131072,  2],
      ['qwq-32b',                    0.00000012, 0.00000018, true,  false, 131072,  1],
      ['qwen-2.5-coder-32b-instruct',0.00000018,0.00000018, false, true,  131072,  2],
      ['qwen3-235b-a22b',            0.0000003,  0.0000012,  true,  true,  131072,  4],
      ['qwen3-32b',                  0.0000001,  0.0000003,  true,  true,  131072,  2],
      // Mistral
      ['mistral-large',              0.000002,   0.000006,   false, true,  128000,  3],
      ['mistral-small',              0.0000002,  0.0000006,  false, false, 128000,  1],
      ['codestral',                  0.0000003,  0.0000009,  false, true,  256000,  2],
      // xAI
      ['grok-3',                     0.000003,   0.000015,   true,  true,  131072,  5],
      ['grok-3-mini',                0.0000003,  0.0000005,  true,  true,  131072,  3],
      ['grok-3-fast',                0.000005,   0.000025,   false, true,  131072,  4],
      ['grok-3-mini-fast',           0.0000006,  0.000004,   false, true,  131072,  2],
      ['grok-2',                     0.000002,   0.00001,    false, true,  131072,  3],
      // Zhipu
      ['glm-4-plus',                 0.0000005,  0.0000005,  false, true,  128000,  2],
      ['glm-4-flash',                0.00000005, 0.00000005, false, false, 128000,  1],
      // Amazon
      ['nova-pro',                   0.0000008,  0.0000032,  false, true,  300000,  3],
      ['nova-lite',                  0.00000006, 0.00000024, false, true,  300000,  2],
      ['nova-micro',                 0.000000035,0.00000014, false, false, 128000,  1],
    ];

    it.each(cases)(
      '%s → quality %i',
      (name, input, output, reasoning, code, ctx, expected) => {
        const result = computeQualityScore(
          m({ model_name: name, input, output, reasoning, code, ctx }),
        );
        expect(result).toBe(expected);
      },
    );
  });

  describe('override map', () => {
    it('should have exactly 6 entries', () => {
      expect(QUALITY_OVERRIDES.size).toBe(6);
    });

    it('should return override value regardless of data signals', () => {
      // gpt-4o would be Q4 by formula ($12.50, code) but override forces Q3
      const result = computeQualityScore(
        m({ model_name: 'gpt-4o', input: 0.0000025, output: 0.00001, code: true }),
      );
      expect(result).toBe(3);
    });
  });

  describe('edge cases', () => {
    it('returns Q1 for model with zero price and no capabilities', () => {
      expect(computeQualityScore(
        m({ model_name: 'free-model', input: 0, output: 0 }),
      )).toBe(1);
    });

    it('returns Q2 for unknown model with code capability at low price', () => {
      expect(computeQualityScore(
        m({ model_name: 'future-cheap-code', input: 0.0000001, output: 0.0000003, code: true }),
      )).toBe(2);
    });

    it('returns Q5 for a future frontier model with both caps', () => {
      expect(computeQualityScore(
        m({ model_name: 'future-frontier', input: 0.00002, output: 0.0001, reasoning: true, code: true }),
      )).toBe(5);
    });

    it('handles a future sonnet variant via override pattern', () => {
      // A new sonnet not in the override map falls through to the formula
      // At $18/M with R+C it would be Q5 (the override map would need updating)
      const result = computeQualityScore(
        m({ model_name: 'claude-sonnet-5', input: 0.000003, output: 0.000015, reasoning: true, code: true }),
      );
      expect(result).toBe(5); // formula result — override map needs updating for new sonnets
    });
  });
});
