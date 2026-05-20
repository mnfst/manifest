import type { AuthType } from './auth-types';
import type {
  ModelParamGroup,
  ModelParamRange,
  ModelParamType,
  ParamApplicability,
  ProviderModelParamSpec,
  ProviderParamSpecCatalog,
} from './provider-params-spec';
import type { JsonValue } from './request-params';

type SeedSpec = {
  path: string;
  type: ModelParamType;
  label: string;
  description: string;
  default: JsonValue;
  values?: readonly JsonValue[];
  range?: ModelParamRange;
  group: ModelParamGroup;
  applicability?: ParamApplicability;
};

const MAX_TOKENS: SeedSpec = {
  path: 'max_tokens',
  type: 'integer',
  label: 'Max tokens',
  description: 'Maximum number of output tokens the model may generate.',
  default: 4096,
  range: { min: 1 },
  group: 'generation_length',
};

const OPENAI_TEMPERATURE: SeedSpec = {
  path: 'temperature',
  type: 'number',
  label: 'Temperature',
  description:
    'Controls randomness. Lower values make outputs more focused; higher values make them more varied.',
  default: 1,
  range: { min: 0, max: 2, step: 0.1 },
  group: 'sampling',
};

const ANTHROPIC_TEMPERATURE: SeedSpec = {
  ...OPENAI_TEMPERATURE,
  range: { min: 0, max: 1, step: 0.1 },
  applicability: { except: { 'thinking.type': ['adaptive', 'enabled'] } },
};

const TOP_P: SeedSpec = {
  path: 'top_p',
  type: 'number',
  label: 'Top P',
  description:
    'Controls nucleus sampling by limiting generation to tokens whose cumulative probability reaches this value.',
  default: 1,
  range: { min: 0, max: 1, step: 0.01 },
  group: 'sampling',
};

const ANTHROPIC_TOP_P: SeedSpec = {
  ...TOP_P,
  applicability: {
    except: [{ 'thinking.type': ['adaptive', 'enabled'] }, { temperature: { not: 1 } }],
  },
};

const TOP_K: SeedSpec = {
  path: 'top_k',
  type: 'integer',
  label: 'Top K',
  description: 'Limits token sampling to the top K most likely next tokens.',
  default: 0,
  range: { min: 0 },
  group: 'sampling',
  applicability: { except: { 'thinking.type': ['adaptive', 'enabled'] } },
};

const OPENAI_REASONING_EFFORT: SeedSpec = {
  path: 'reasoning_effort',
  type: 'enum',
  label: 'Reasoning effort',
  description: 'Controls how much reasoning the model should perform before producing an answer.',
  default: 'medium',
  values: ['minimal', 'low', 'medium', 'high'],
  group: 'reasoning',
};

const OPENAI_XHIGH_REASONING_EFFORT: SeedSpec = {
  ...OPENAI_REASONING_EFFORT,
  values: ['minimal', 'low', 'medium', 'high', 'xhigh'],
};

const OPENAI_GPT_5_1_REASONING_EFFORT: SeedSpec = {
  ...OPENAI_REASONING_EFFORT,
  default: 'none',
  values: ['none', 'low', 'medium', 'high'],
};

const OPENAI_SUBSCRIPTION_REASONING_EFFORT: SeedSpec = {
  path: 'reasoning.effort',
  type: 'enum',
  label: 'Reasoning effort',
  description: 'Controls how much reasoning the model should perform before producing an answer.',
  default: 'medium',
  values: ['minimal', 'low', 'medium', 'high'],
  group: 'reasoning',
};

const OPENAI_SUBSCRIPTION_XHIGH_REASONING_EFFORT: SeedSpec = {
  ...OPENAI_SUBSCRIPTION_REASONING_EFFORT,
  values: ['minimal', 'low', 'medium', 'high', 'xhigh'],
};

const OPENAI_SUBSCRIPTION_REASONING_SUMMARY: SeedSpec = {
  path: 'reasoning.summary',
  type: 'enum',
  label: 'Reasoning summary',
  description: 'Controls the level of reasoning summary returned with the response.',
  default: 'auto',
  values: ['auto', 'concise', 'detailed', 'none'],
  group: 'reasoning',
};

const OPENAI_SUBSCRIPTION_VERBOSITY: SeedSpec = {
  path: 'text.verbosity',
  type: 'enum',
  label: 'Verbosity',
  description: "Controls how concise or detailed the model's final text response should be.",
  default: 'medium',
  values: ['low', 'medium', 'high'],
  group: 'output_format',
};

const THINKING_TYPE_ADAPTIVE_ONLY: SeedSpec = {
  path: 'thinking.type',
  type: 'enum',
  label: 'Thinking mode',
  description: 'Controls the Anthropic thinking mode values supported by this model.',
  default: 'disabled',
  values: ['disabled', 'adaptive'],
  group: 'reasoning',
};

const THINKING_TYPE_EXTENDED_ONLY: SeedSpec = {
  ...THINKING_TYPE_ADAPTIVE_ONLY,
  values: ['disabled', 'enabled'],
};

const THINKING_TYPE_FULL: SeedSpec = {
  ...THINKING_TYPE_ADAPTIVE_ONLY,
  values: ['disabled', 'adaptive', 'enabled'],
};

const THINKING_BUDGET_TOKENS: SeedSpec = {
  path: 'thinking.budget_tokens',
  type: 'integer',
  label: 'Budget tokens',
  description:
    'Maximum token budget Anthropic may use for extended thinking before producing the final answer.',
  default: 4096,
  range: { min: 1024 },
  group: 'reasoning',
  applicability: { only: { 'thinking.type': 'enabled' } },
};

const DEEPSEEK_THINKING: SeedSpec = {
  path: 'thinking.type',
  type: 'enum',
  label: 'Thinking mode',
  description: 'Controls whether DeepSeek thinking mode is enabled for this model.',
  default: 'enabled',
  values: ['enabled', 'disabled'],
  group: 'reasoning',
};

const OPENAI_CHAT_SAMPLING_MODELS = [
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-4o-2024-11-20',
  'gpt-4.1',
  'gpt-4.1-mini',
  'gpt-4.1-nano',
  'gpt-4-turbo',
  'gpt-4-turbo-2024-04-09',
  'gpt-3.5-turbo',
  'chatgpt-4o-latest',
] as const;

const OPENAI_O_SERIES_REASONING_MODELS = [
  'o1',
  'o1-mini',
  'o1-preview',
  'o3',
  'o3-mini',
  'o4-mini',
] as const;

const OPENAI_GPT_5_REASONING_MODELS = [
  'gpt-5',
  'gpt-5-mini',
  'gpt-5-nano',
  'gpt-5-chat-latest',
] as const;

const OPENAI_GPT_5_XHIGH_REASONING_MODELS = [
  'gpt-5.2',
  'gpt-5.4',
  'gpt-5.4-mini',
  'gpt-5.5',
] as const;

const OPENAI_GPT_5_1_REASONING_MODELS = ['gpt-5.1'] as const;

const OPENAI_SUBSCRIPTION_XHIGH_REASONING_MODELS = [
  'gpt-5.5',
  'gpt-5.4',
  'gpt-5.4-mini',
  'gpt-5.3-codex',
  'gpt-5.3-codex-spark',
  'gpt-5.2-codex',
  'gpt-5.2',
  'gpt-5.1-codex-max',
] as const;

const OPENAI_SUBSCRIPTION_MODELS = ['gpt-5.1-codex'] as const;

const ANTHROPIC_ADAPTIVE_ONLY_MODELS = ['claude-opus-4-7'] as const;

const ANTHROPIC_FULL_THINKING_MODELS = [
  'claude-sonnet-4-6',
  'claude-opus-4-6',
  'claude-sonnet-4-5',
  'claude-sonnet-4-5-20250929',
  'claude-opus-4',
  'claude-sonnet-4',
] as const;

const ANTHROPIC_EXTENDED_ONLY_MODELS = [
  'claude-haiku-4-5',
  'claude-haiku-4-5-20251001',
  'claude-haiku-4',
  'claude-3-7-sonnet-latest',
  'claude-3-7-sonnet-20250219',
] as const;

const ANTHROPIC_SAMPLING_ONLY_MODELS = [
  'claude-3-5-sonnet-latest',
  'claude-3-5-sonnet-20241022',
  'claude-3-5-haiku-latest',
  'claude-3-5-haiku-20241022',
  'claude-3-opus-latest',
  'claude-3-opus-20240229',
] as const;

const ANTHROPIC_SUBSCRIPTION_FULL_THINKING_MODELS = ['claude-opus-4', 'claude-sonnet-4'] as const;

const ANTHROPIC_SUBSCRIPTION_EXTENDED_ONLY_MODELS = ['claude-haiku-4'] as const;

const DEEPSEEK_THINKING_MODELS = [
  'deepseek-chat',
  'deepseek-v3.1',
  'deepseek-v3.2',
  'deepseek-v4',
] as const;

/**
 * Bundled Model Parameters Schema (MPS) catalog.
 *
 * This is intentionally shaped exactly like the `/model-param-specs` API payload:
 * an array of JSON-serializable provider/auth/model param specs. When a remote
 * params API exists, the runtime source can swap from this bundled fallback to
 * fetched JSON without changing the dialog, proxy, or storage model.
 */
export const MODEL_PARAMETERS_SCHEMA: ProviderParamSpecCatalog = providerParamRows();

function providerParamRows(): ProviderParamSpecCatalog {
  return [
    ...OPENAI_CHAT_SAMPLING_MODELS.map((model) =>
      openAiSpec(model, [MAX_TOKENS, OPENAI_TEMPERATURE, TOP_P]),
    ),
    ...OPENAI_O_SERIES_REASONING_MODELS.map((model) =>
      openAiSpec(model, [MAX_TOKENS, OPENAI_REASONING_EFFORT]),
    ),
    ...OPENAI_GPT_5_REASONING_MODELS.map((model) =>
      openAiSpec(model, [MAX_TOKENS, OPENAI_TEMPERATURE, TOP_P, OPENAI_REASONING_EFFORT]),
    ),
    ...OPENAI_GPT_5_XHIGH_REASONING_MODELS.map((model) =>
      openAiSpec(model, [MAX_TOKENS, OPENAI_TEMPERATURE, TOP_P, OPENAI_XHIGH_REASONING_EFFORT]),
    ),
    ...OPENAI_GPT_5_1_REASONING_MODELS.map((model) =>
      openAiSpec(model, [MAX_TOKENS, OPENAI_TEMPERATURE, TOP_P, OPENAI_GPT_5_1_REASONING_EFFORT]),
    ),
    ...OPENAI_SUBSCRIPTION_MODELS.map((model) =>
      openAiSpecForAuth('subscription', model, [
        OPENAI_SUBSCRIPTION_REASONING_EFFORT,
        OPENAI_SUBSCRIPTION_REASONING_SUMMARY,
        OPENAI_SUBSCRIPTION_VERBOSITY,
      ]),
    ),
    ...OPENAI_SUBSCRIPTION_XHIGH_REASONING_MODELS.map((model) =>
      openAiSpecForAuth('subscription', model, [
        OPENAI_SUBSCRIPTION_XHIGH_REASONING_EFFORT,
        OPENAI_SUBSCRIPTION_REASONING_SUMMARY,
        OPENAI_SUBSCRIPTION_VERBOSITY,
      ]),
    ),
    ...ANTHROPIC_ADAPTIVE_ONLY_MODELS.map((model) =>
      anthropicSpec(model, [THINKING_TYPE_ADAPTIVE_ONLY]),
    ),
    ...ANTHROPIC_FULL_THINKING_MODELS.map((model) =>
      anthropicSpec(model, [THINKING_TYPE_FULL, THINKING_BUDGET_TOKENS]),
    ),
    ...ANTHROPIC_EXTENDED_ONLY_MODELS.map((model) =>
      anthropicSpec(model, [THINKING_TYPE_EXTENDED_ONLY, THINKING_BUDGET_TOKENS]),
    ),
    ...ANTHROPIC_SAMPLING_ONLY_MODELS.map((model) => anthropicSpec(model, [])),
    ...ANTHROPIC_SUBSCRIPTION_FULL_THINKING_MODELS.map((model) =>
      anthropicSpecForAuth('subscription', model, [THINKING_TYPE_FULL, THINKING_BUDGET_TOKENS]),
    ),
    ...ANTHROPIC_SUBSCRIPTION_EXTENDED_ONLY_MODELS.map((model) =>
      anthropicSpecForAuth('subscription', model, [
        THINKING_TYPE_EXTENDED_ONLY,
        THINKING_BUDGET_TOKENS,
      ]),
    ),
    ...DEEPSEEK_THINKING_MODELS.map((model) =>
      providerModelSpec('deepseek', 'api_key', model, [DEEPSEEK_THINKING]),
    ),
  ];
}

function openAiSpec(model: string, specs: readonly SeedSpec[]): ProviderModelParamSpec {
  return openAiSpecForAuth('api_key', model, specs);
}

function openAiSpecForAuth(
  authType: 'api_key' | 'subscription',
  model: string,
  specs: readonly SeedSpec[],
): ProviderModelParamSpec {
  return providerModelSpec('openai', authType, model, specs);
}

function anthropicSpec(model: string, reasoningSpecs: readonly SeedSpec[]): ProviderModelParamSpec {
  return anthropicSpecForAuth('api_key', model, reasoningSpecs);
}

function anthropicSpecForAuth(
  authType: 'api_key' | 'subscription',
  model: string,
  reasoningSpecs: readonly SeedSpec[],
): ProviderModelParamSpec {
  return providerModelSpec('anthropic', authType, model, [
    MAX_TOKENS,
    ANTHROPIC_TEMPERATURE,
    ANTHROPIC_TOP_P,
    TOP_K,
    ...reasoningSpecs,
  ]);
}

function providerModelSpec(
  provider: string,
  authType: AuthType,
  model: string,
  params: readonly SeedSpec[],
): ProviderModelParamSpec {
  return {
    provider,
    authType,
    model,
    params: params.map((param) => ({ ...param })),
  };
}
