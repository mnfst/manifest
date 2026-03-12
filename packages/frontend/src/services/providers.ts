/* ── LLM Provider definitions (shared by Routing page) ── */

export interface ProviderDef {
  id: string;
  name: string;
  color: string;
  initial: string;
  subtitle: string;
  models: { label: string; value: string }[];
  keyPrefix: string;
  minKeyLength: number;
  keyPlaceholder: string;
  noKeyRequired?: boolean;
  localOnly?: boolean;
  /** Provider supports OpenClaw OAuth/subscription auth (setup-token, OAuth, device-login). */
  supportsSubscription?: boolean;
  /** Label shown in the subscription tab for this provider. */
  subscriptionLabel?: string;
  /** Placeholder for the subscription token input (providers that need a pasted token). */
  subscriptionKeyPlaceholder?: string;
  /** Instructions text shown in the subscription detail view. */
  subscriptionCommand?: string;
}

export const PROVIDERS: ProviderDef[] = [
  {
    id: 'qwen',
    name: 'Alibaba',
    color: '#FF6003',
    initial: 'Al',
    subtitle: 'Qwen3, Qwen2.5, QwQ',
    keyPrefix: 'sk-',
    minKeyLength: 30,
    keyPlaceholder: 'sk-...',
    models: [
      { label: 'Qwen3 235B A22B', value: 'qwen3-235b-a22b' },
      { label: 'Qwen3 32B', value: 'qwen3-32b' },
      { label: 'Qwen3 14B', value: 'qwen3-14b' },
      { label: 'Qwen3 8B', value: 'qwen3-8b' },
      { label: 'Qwen3 4B', value: 'qwen3-4b' },
      { label: 'Qwen3 1.7B', value: 'qwen3-1.7b' },
      { label: 'Qwen3 0.6B', value: 'qwen3-0.6b' },
      { label: 'Qwen2.5 72B Instruct', value: 'qwen2.5-72b-instruct' },
      { label: 'Qwen2.5 72B Instruct', value: 'qwen-2.5-72b-instruct' },
      { label: 'Qwen2.5 32B Instruct', value: 'qwen2.5-32b-instruct' },
      { label: 'Qwen2.5 Coder 32B', value: 'qwen2.5-coder-32b-instruct' },
      { label: 'Qwen2.5 Coder 32B', value: 'qwen-2.5-coder-32b-instruct' },
      { label: 'QwQ 32B (Reasoning)', value: 'qwq-32b' },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    color: '#d97757',
    initial: 'A',
    subtitle: 'Claude Opus 4, Sonnet 4.5, Haiku',
    keyPrefix: 'sk-ant-',
    minKeyLength: 50,
    keyPlaceholder: 'sk-ant-...',
    supportsSubscription: true,
    subscriptionLabel: 'Claude Max / Pro subscription',
    subscriptionKeyPlaceholder: 'Paste your setup-token',
    subscriptionCommand: 'claude setup-token',
    models: [
      { label: 'Claude Opus 4.6', value: 'claude-opus-4-6' },
      { label: 'Claude Opus 4', value: 'claude-opus-4' },
      { label: 'Claude Opus 4 (2025-05-14)', value: 'claude-opus-4-20250514' },
      { label: 'Claude Sonnet 4.5', value: 'claude-sonnet-4-5' },
      { label: 'Claude Sonnet 4.5', value: 'claude-sonnet-4-5-20250929' },
      { label: 'Claude Sonnet 4.5 (2025-04-14)', value: 'claude-sonnet-4-5-20250414' },
      { label: 'Claude Sonnet 4', value: 'claude-sonnet-4' },
      { label: 'Claude Sonnet 4 (2025-05-14)', value: 'claude-sonnet-4-20250514' },
      { label: 'Claude Haiku 4.5', value: 'claude-haiku-4-5' },
      { label: 'Claude Haiku 4.5 (2025-10-01)', value: 'claude-haiku-4-5-20251001' },
      { label: 'Claude 3.5 Sonnet', value: 'claude-3-5-sonnet-latest' },
      { label: 'Claude 3.5 Sonnet (2024-10-22)', value: 'claude-3-5-sonnet-20241022' },
      { label: 'Claude 3.5 Sonnet (2024-06-20)', value: 'claude-3-5-sonnet-20240620' },
      { label: 'Claude 3.5 Haiku', value: 'claude-3-5-haiku-latest' },
      { label: 'Claude 3.5 Haiku (2024-10-22)', value: 'claude-3-5-haiku-20241022' },
      { label: 'Claude 3 Opus', value: 'claude-3-opus-latest' },
      { label: 'Claude 3 Opus (2024-02-29)', value: 'claude-3-opus-20240229' },
      { label: 'Claude 3 Sonnet', value: 'claude-3-sonnet-20240229' },
      { label: 'Claude 3 Haiku', value: 'claude-3-haiku-20240307' },
    ],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    color: '#4d6bfe',
    initial: 'D',
    subtitle: 'DeepSeek V3, R1',
    keyPrefix: 'sk-',
    minKeyLength: 30,
    keyPlaceholder: 'sk-...',
    models: [
      { label: 'DeepSeek V3', value: 'deepseek-chat' },
      { label: 'DeepSeek V3 (0324)', value: 'deepseek-chat-0324' },
      { label: 'DeepSeek R1', value: 'deepseek-reasoner' },
      { label: 'DeepSeek R1 (0528)', value: 'deepseek-reasoner-0528' },
      { label: 'DeepSeek Coder V2', value: 'deepseek-coder' },
      { label: 'DeepSeek R1 Distill Qwen 32B', value: 'deepseek-r1-distill-qwen-32b' },
      { label: 'DeepSeek R1 Distill Llama 70B', value: 'deepseek-r1-distill-llama-70b' },
    ],
  },
  {
    id: 'gemini',
    name: 'Gemini',
    color: '#4285f4',
    initial: 'G',
    subtitle: 'Gemini 2.5, Gemini 2.0 Flash',
    keyPrefix: 'AIza',
    minKeyLength: 39,
    keyPlaceholder: 'AIza...',
    models: [
      { label: 'Gemini 2.5 Pro', value: 'gemini-2.5-pro' },
      { label: 'Gemini 2.5 Pro (Preview)', value: 'gemini-2.5-pro-preview-05-06' },
      { label: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash' },
      { label: 'Gemini 2.5 Flash (Preview)', value: 'gemini-2.5-flash-preview-04-17' },
      { label: 'Gemini 2.5 Flash Lite', value: 'gemini-2.5-flash-lite' },
      { label: 'Gemini 2.0 Flash', value: 'gemini-2.0-flash' },
      { label: 'Gemini 2.0 Flash Lite', value: 'gemini-2.0-flash-lite' },
      { label: 'Gemini 1.5 Pro', value: 'gemini-1.5-pro' },
      { label: 'Gemini 1.5 Pro (002)', value: 'gemini-1.5-pro-002' },
      { label: 'Gemini 1.5 Flash', value: 'gemini-1.5-flash' },
      { label: 'Gemini 1.5 Flash (002)', value: 'gemini-1.5-flash-002' },
      { label: 'Gemini 1.5 Flash-8B', value: 'gemini-1.5-flash-8b' },
    ],
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    color: '#E73562',
    initial: 'Mm',
    subtitle: 'MiniMax M2.5, M1, M2',
    keyPrefix: 'sk-api-',
    minKeyLength: 30,
    keyPlaceholder: 'sk-api-...',
    models: [
      { label: 'MiniMax M2.5', value: 'MiniMax-M2.5' },
      { label: 'MiniMax M2.5 Highspeed', value: 'MiniMax-M2.5-highspeed' },
      { label: 'MiniMax M2.1', value: 'MiniMax-M2.1' },
      { label: 'MiniMax M2.1 Highspeed', value: 'MiniMax-M2.1-highspeed' },
      { label: 'MiniMax M2', value: 'MiniMax-M2' },
      { label: 'MiniMax M2 Her', value: 'MiniMax-M2-her' },
      { label: 'MiniMax M1', value: 'MiniMax-M1' },
      { label: 'MiniMax-01', value: 'MiniMax-01' },
    ],
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    color: '#f97316',
    initial: 'M',
    subtitle: 'Mistral Large, Codestral, Pixtral',
    keyPrefix: '',
    minKeyLength: 32,
    keyPlaceholder: 'API key',
    models: [
      { label: 'Mistral Large', value: 'mistral-large' },
      { label: 'Mistral Large (25.01)', value: 'mistral-large-latest' },
      { label: 'Mistral Large (24.11)', value: 'mistral-large-2411' },
      { label: 'Mistral Small', value: 'mistral-small' },
      { label: 'Mistral Small (25.01)', value: 'mistral-small-latest' },
      { label: 'Mistral Small (24.09)', value: 'mistral-small-2409' },
      { label: 'Mistral Medium', value: 'mistral-medium-latest' },
      { label: 'Codestral', value: 'codestral' },
      { label: 'Codestral (25.01)', value: 'codestral-latest' },
      { label: 'Codestral Mamba', value: 'codestral-mamba-latest' },
      { label: 'Mistral Nemo', value: 'open-mistral-nemo' },
      { label: 'Pixtral Large', value: 'pixtral-large-latest' },
      { label: 'Pixtral 12B', value: 'pixtral-12b-2409' },
      { label: 'Mistral 7B', value: 'open-mistral-7b' },
    ],
  },
  {
    id: 'moonshot',
    name: 'Moonshot',
    color: '#1a1a2e',
    initial: 'Mo',
    subtitle: 'Kimi k2, Moonshot v1',
    keyPrefix: 'sk-',
    minKeyLength: 30,
    keyPlaceholder: 'sk-...',
    models: [
      { label: 'Kimi k2', value: 'kimi-k2' },
      { label: 'Moonshot v1 128K', value: 'moonshot-v1-128k' },
      { label: 'Moonshot v1 32K', value: 'moonshot-v1-32k' },
      { label: 'Moonshot v1 8K', value: 'moonshot-v1-8k' },
    ],
  },
  {
    id: 'ollama',
    name: 'Ollama',
    color: '#1a1a1a',
    initial: 'Ol',
    subtitle: 'Llama, Mistral, Gemma, and more',
    keyPrefix: '',
    minKeyLength: 0,
    keyPlaceholder: '',
    noKeyRequired: true,
    models: [],
    localOnly: true,
  },
  {
    id: 'openai',
    name: 'OpenAI',
    color: '#10a37f',
    initial: 'O',
    subtitle: 'GPT-4o, GPT-4.1, o3, o4',
    keyPrefix: 'sk-',
    minKeyLength: 50,
    keyPlaceholder: 'sk-...',
    models: [
      { label: 'GPT-4o', value: 'gpt-4o' },
      { label: 'GPT-4o Mini', value: 'gpt-4o-mini' },
      { label: 'GPT-4o (2024-11-20)', value: 'gpt-4o-2024-11-20' },
      { label: 'GPT-4.1', value: 'gpt-4.1' },
      { label: 'GPT-4.1 Mini', value: 'gpt-4.1-mini' },
      { label: 'GPT-4.1 Nano', value: 'gpt-4.1-nano' },
      { label: 'GPT-4 Turbo', value: 'gpt-4-turbo' },
      { label: 'GPT-4 Turbo (2024-04-09)', value: 'gpt-4-turbo-2024-04-09' },
      { label: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo' },
      { label: 'o3', value: 'o3' },
      { label: 'o3 Mini', value: 'o3-mini' },
      { label: 'o4 Mini', value: 'o4-mini' },
      { label: 'o1', value: 'o1' },
      { label: 'o1 Mini', value: 'o1-mini' },
      { label: 'o1 Preview', value: 'o1-preview' },
    ],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    color: '#6366f1',
    initial: 'OR',
    subtitle: 'Auto-route to 300+ models',
    keyPrefix: 'sk-or-',
    minKeyLength: 60,
    keyPlaceholder: 'sk-or-...',
    models: [
      { label: 'Auto (best for prompt)', value: 'openrouter/auto' },
      { label: 'Free Models Router', value: 'openrouter/free' },
      { label: 'Step 3.5 Flash (Free)', value: 'stepfun/step-3.5-flash:free' },
      { label: 'Trinity Large Preview (Free)', value: 'arcee-ai/trinity-large-preview:free' },
      { label: 'Solar Pro 3 (Free)', value: 'upstage/solar-pro-3:free' },
      { label: 'LFM 2.5 1.2B Thinking (Free)', value: 'liquid/lfm-2.5-1.2b-thinking:free' },
      { label: 'LFM 2.5 1.2B Instruct (Free)', value: 'liquid/lfm-2.5-1.2b-instruct:free' },
      { label: 'Trinity Mini (Free)', value: 'arcee-ai/trinity-mini:free' },
      { label: 'Nemotron 3 Nano 30B (Free)', value: 'nvidia/nemotron-3-nano-30b-a3b:free' },
    ],
  },
  {
    id: 'xai',
    name: 'xAI',
    color: '#555555',
    initial: 'X',
    subtitle: 'Grok 3, Grok 2',
    keyPrefix: 'xai-',
    minKeyLength: 50,
    keyPlaceholder: 'xai-...',
    models: [
      { label: 'Grok 3', value: 'grok-3' },
      { label: 'Grok 3 Mini', value: 'grok-3-mini' },
      { label: 'Grok 3 Fast', value: 'grok-3-fast' },
      { label: 'Grok 3 Mini Fast', value: 'grok-3-mini-fast' },
      { label: 'Grok 2', value: 'grok-2' },
      { label: 'Grok 2 Mini', value: 'grok-2-mini' },
    ],
  },
  {
    id: 'zai',
    name: 'Z.ai',
    color: '#2d2d2d',
    initial: 'Z',
    subtitle: 'GLM 5, GLM 4.7, GLM 4.5',
    keyPrefix: '',
    minKeyLength: 30,
    keyPlaceholder: 'API key',
    models: [
      { label: 'GLM 5', value: 'glm-5' },
      { label: 'GLM 4.7', value: 'glm-4.7' },
      { label: 'GLM 4.7 Flash', value: 'glm-4.7-flash' },
      { label: 'GLM 4.6', value: 'glm-4.6' },
      { label: 'GLM 4.6V', value: 'glm-4.6v' },
      { label: 'GLM 4.5', value: 'glm-4.5' },
      { label: 'GLM 4.5 Air', value: 'glm-4.5-air' },
      { label: 'GLM 4.5 Flash', value: 'glm-4.5-flash' },
    ],
  },
];

/* ── Pipeline stage definitions ────────────────────── */

export interface StageDef {
  id: string;
  step: number;
  label: string;
  desc: string;
}

export const STAGES: StageDef[] = [
  {
    id: 'simple',
    step: 1,
    label: 'Simple',
    desc: 'Heartbeats, greetings, and low-cost tasks that any model can handle.',
  },
  {
    id: 'standard',
    step: 2,
    label: 'Standard',
    desc: 'General-purpose requests that need a good balance of quality and cost.',
  },
  {
    id: 'complex',
    step: 3,
    label: 'Complex',
    desc: 'Tasks requiring high quality, nuance, or multi-step reasoning.',
  },
  {
    id: 'reasoning',
    step: 4,
    label: 'Reasoning',
    desc: 'Advanced reasoning, planning, and critical decision-making.',
  },
];

/* ── Helpers — re-exported from provider-utils.ts ── */
export {
  getProvider,
  validateApiKey,
  validateSubscriptionKey,
  getModelLabel,
} from './provider-utils.js';
