import { describe, it, expect } from 'vitest';
import { providerIdForModel } from '../../src/services/routing-model-utils.js';
import type { AvailableModel } from '../../src/services/api.js';

describe('providerIdForModel', () => {
  const models: AvailableModel[] = [
    {
      model_name: 'gpt-4o',
      display_name: 'GPT-4o',
      provider: 'OpenAI',
      provider_display_name: 'OpenAI',
      input_price_per_token: 0,
      output_price_per_token: 0,
      quality_score: 1,
      capabilities: [],
    },
  ];

  it('returns provider id from discovery row', () => {
    expect(providerIdForModel('gpt-4o', models)).toBe('openai');
  });

  it('infers from model prefix when not in catalog', () => {
    expect(providerIdForModel('claude-3-opus', [])).toBe('anthropic');
  });
});
