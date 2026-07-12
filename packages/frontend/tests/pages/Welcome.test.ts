import { describe, expect, it } from 'vitest';
import type { AvailableModel } from '../../src/services/api.js';
import {
  findResumableAgent,
  isSuccessfulAgentMessage,
  proposeChain,
} from '../../src/pages/Welcome.js';

const model = (
  provider: string,
  modelName: string,
  quality: number,
  authType: AvailableModel['auth_type'] = 'api_key',
): AvailableModel => ({
  provider,
  model_name: modelName,
  auth_type: authType,
  quality_score: quality,
  input_price_per_token: null,
  output_price_per_token: null,
  context_window: 128_000,
  capability_reasoning: false,
  capability_code: false,
});

describe('proposeChain', () => {
  it('picks the strongest model from each provider, not each credential', () => {
    const chain = proposeChain([
      model('openai', 'gpt-4.1-mini', 80, 'api_key'),
      model('OPENAI', 'gpt-4.1', 96, 'subscription'),
      model('anthropic', 'claude-sonnet-4', 94),
      model('google', 'gemini-2.5-pro', 92),
    ]);

    expect(chain.map((entry) => entry.model_name)).toEqual([
      'gpt-4.1',
      'claude-sonnet-4',
      'gemini-2.5-pro',
    ]);
    expect(new Set(chain.map((entry) => entry.provider.toLowerCase())).size).toBe(3);
  });

  it('limits the default route to one primary and two independent fallbacks', () => {
    const chain = proposeChain([
      model('openai', 'gpt-4.1', 96),
      model('anthropic', 'claude-sonnet-4', 94),
      model('google', 'gemini-2.5-pro', 92),
      model('mistral', 'mistral-large', 90),
    ]);

    expect(chain).toHaveLength(3);
    expect(chain.map((entry) => entry.provider)).toEqual(['openai', 'anthropic', 'google']);
  });

  it('uses the starred Playground model as primary and keeps independent fallbacks', () => {
    const chain = proposeChain(
      [
        model('openai', 'gpt-4.1', 96),
        model('anthropic', 'claude-sonnet-4', 94),
        model('google', 'gemini-2.5-flash', 80),
      ],
      { model: 'gemini-2.5-flash', provider: 'google', authType: 'api_key' },
    );

    expect(chain.map((entry) => entry.model_name)).toEqual([
      'gemini-2.5-flash',
      'gpt-4.1',
      'claude-sonnet-4',
    ]);
  });
});

describe('onboarding activation helpers', () => {
  it('resumes the newest zero-message harness', () => {
    expect(
      findResumableAgent([
        { agent_name: 'activated', message_count: 3, has_successful_message: true },
        { agent_name: 'newest-unfinished', message_count: 1, has_successful_message: false },
        { agent_name: 'older-unfinished', message_count: 0, has_successful_message: false },
      ])?.agent_name,
    ).toBe('newest-unfinished');
  });

  it('does not treat a failed request as activation', () => {
    expect(isSuccessfulAgentMessage({ status: 'failed' })).toBe(false);
    expect(isSuccessfulAgentMessage({ status: 'rate_limited' })).toBe(false);
    expect(isSuccessfulAgentMessage({ status: 'ok' })).toBe(true);
  });
});
