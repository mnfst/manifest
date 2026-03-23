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
  /** Provider uses GitHub device login instead of token paste. */
  deviceLogin?: boolean;
  /** UI auth mode for subscription flows. */
  subscriptionAuthMode?: 'popup_oauth' | 'device_code' | 'token';
  /** When true, provider only appears in the Subscriptions tab (not API Keys). */
  subscriptionOnly?: boolean;
  /** Deprecated compatibility flag for popup OAuth providers. */
  subscriptionOAuth?: boolean;
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
    models: [],
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
    subscriptionAuthMode: 'token',
    subscriptionKeyPlaceholder: 'Paste your setup-token',
    subscriptionCommand: 'claude setup-token',
    models: [],
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
    models: [],
  },
  {
    id: 'copilot',
    name: 'GitHub Copilot',
    color: '#000000',
    initial: 'GH',
    subtitle: 'Claude, GPT, Gemini via Copilot',
    keyPrefix: '',
    minKeyLength: 0,
    keyPlaceholder: '',
    supportsSubscription: true,
    subscriptionLabel: 'GitHub Copilot subscription',
    subscriptionAuthMode: 'device_code',
    deviceLogin: true,
    models: [
      { label: 'Claude Opus 4', value: 'copilot/claude-opus-4' },
      { label: 'Claude Sonnet 4.5', value: 'copilot/claude-sonnet-4.5' },
      { label: 'Claude Sonnet 4', value: 'copilot/claude-sonnet-4' },
      { label: 'Claude Haiku 4.5', value: 'copilot/claude-haiku-4.5' },
      { label: 'GPT-4o', value: 'copilot/gpt-4o' },
      { label: 'GPT-4.1', value: 'copilot/gpt-4.1' },
      { label: 'GPT-5', value: 'copilot/gpt-5' },
      { label: 'o3 Mini', value: 'copilot/o3-mini' },
      { label: 'o4 Mini', value: 'copilot/o4-mini' },
      { label: 'Gemini 2.5 Pro', value: 'copilot/gemini-2.5-pro' },
      { label: 'Gemini 2.5 Flash', value: 'copilot/gemini-2.5-flash' },
    ],
  },
  {
    id: 'gemini',
    name: 'Google',
    color: '#4285f4',
    initial: 'G',
    subtitle: 'Gemini 2.5, Gemini 2.0 Flash',
    keyPrefix: 'AIza',
    minKeyLength: 39,
    keyPlaceholder: 'AIza...',
    models: [],
  },
  {
    id: 'kimi',
    name: 'Kimi Code',
    color: '#111827',
    initial: 'Ki',
    subtitle: 'Kimi For Coding',
    keyPrefix: 'sk-kimi-',
    minKeyLength: 30,
    keyPlaceholder: 'sk-kimi-...',
    supportsSubscription: true,
    subscriptionOnly: true,
    subscriptionLabel: 'Kimi Code subscription',
    subscriptionAuthMode: 'token',
    subscriptionKeyPlaceholder: 'Paste your API key',
    models: [],
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
    supportsSubscription: true,
    subscriptionLabel: 'MiniMax Coding Plan',
    subscriptionAuthMode: 'device_code',
    models: [],
  },
  {
    id: 'mistral',
    name: 'Mistral',
    color: '#f97316',
    initial: 'M',
    subtitle: 'Mistral Large, Codestral, Pixtral',
    keyPrefix: '',
    minKeyLength: 32,
    keyPlaceholder: 'API key',
    models: [],
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
    models: [],
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
    id: 'ollama-cloud',
    name: 'Ollama Cloud',
    color: '#1a1a1a',
    initial: 'Ol',
    subtitle: 'Qwen, DeepSeek, Gemma, GLM, and more',
    keyPrefix: '',
    minKeyLength: 30,
    keyPlaceholder: 'API key',
    supportsSubscription: true,
    subscriptionOnly: true,
    subscriptionLabel: 'Ollama Cloud Plan',
    subscriptionAuthMode: 'token',
    subscriptionKeyPlaceholder: 'Paste your API key',
    models: [],
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
    supportsSubscription: true,
    subscriptionLabel: 'ChatGPT Plus/Pro/Team',
    subscriptionAuthMode: 'popup_oauth',
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
    id: 'opencode',
    name: 'OpenCode',
    color: '#1a1a1a',
    initial: 'Oc',
    subtitle: 'Claude, GPT, Gemini, and more',
    keyPrefix: 'sk-',
    minKeyLength: 50,
    keyPlaceholder: 'sk-...',
    models: [],
  },
  {
    id: 'opencode-go',
    name: 'OpenCode Go',
    color: '#2d8c3c',
    initial: 'Go',
    subtitle: 'GLM 5, Kimi K2.5, MiniMax',
    keyPrefix: 'sk-',
    minKeyLength: 50,
    keyPlaceholder: 'sk-...',
    supportsSubscription: true,
    subscriptionOnly: true,
    subscriptionLabel: 'OpenCode Go Plan',
    subscriptionAuthMode: 'token',
    subscriptionKeyPlaceholder: 'Paste your API key',
    models: [],
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
    models: [],
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
    models: [],
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
    supportsSubscription: true,
    subscriptionLabel: 'Z.ai Coding Plan',
    subscriptionAuthMode: 'token',
    subscriptionKeyPlaceholder: 'Paste your API key',
    models: [],
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

/* ── Helpers ── */
export { getProvider, getModelLabel } from './provider-utils.js';
