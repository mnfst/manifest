import { MODEL_PARAMETERS_SCHEMA } from '../src/model-parameters-schema';
import {
  getProviderParamSpecs,
  isParamApplicability,
  isProviderParamPath,
  providerParamValueIsValid,
} from '../src/provider-params-spec';

describe('MODEL_PARAMETERS_SCHEMA', () => {
  it('is an API-shaped JSON catalog', () => {
    expect(MODEL_PARAMETERS_SCHEMA.length).toBeGreaterThan(0);
    expect(JSON.parse(JSON.stringify(MODEL_PARAMETERS_SCHEMA))).toEqual(MODEL_PARAMETERS_SCHEMA);
  });

  it('contains representative provider/auth/model parameter sets', () => {
    expect(
      getProviderParamSpecs(MODEL_PARAMETERS_SCHEMA, 'openai', 'api_key', 'gpt-5.5').map(
        (spec) => spec.path,
      ),
    ).toEqual(['max_tokens', 'temperature', 'top_p', 'reasoning_effort']);

    expect(
      getProviderParamSpecs(MODEL_PARAMETERS_SCHEMA, 'openai', 'subscription', 'gpt-5.5').map(
        (spec) => spec.path,
      ),
    ).toEqual(['reasoning.effort', 'reasoning.summary', 'text.verbosity']);

    expect(
      getProviderParamSpecs(
        MODEL_PARAMETERS_SCHEMA,
        'anthropic',
        'api_key',
        'claude-haiku-4-5-20251001',
      ).map((spec) => spec.path),
    ).toEqual([
      'max_tokens',
      'temperature',
      'top_k',
      'top_p',
      'thinking.type',
      'thinking.budget_tokens',
    ]);

    expect(
      getProviderParamSpecs(MODEL_PARAMETERS_SCHEMA, 'deepseek', 'api_key', 'deepseek-v4').map(
        (spec) => spec.path,
      ),
    ).toEqual(['thinking.type']);
  });

  it('contains only valid schema entries', () => {
    for (const entry of MODEL_PARAMETERS_SCHEMA) {
      expect(entry.params.length).toBeGreaterThan(0);
      for (const spec of entry.params) {
        expect(spec.description.trim()).not.toBe('');
        expect(isProviderParamPath(spec.path)).toBe(true);
        expect(providerParamValueIsValid(spec, spec.default)).toBe(true);
        if (spec.applicability) {
          expect(isParamApplicability(spec.applicability)).toBe(true);
        }
      }
    }
  });
});
