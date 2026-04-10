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
  /**
   * Credential kind used for subscription auth. Drives the input label and
   * aria-labels in the subscription detail view. Defaults to 'setup-token'
   * for providers that historically used the Anthropic-style setup-token flow.
   */
  subscriptionCredentialKind?: 'setup-token' | 'api-key';
  /** Instructions text shown in the subscription detail view. */
  subscriptionCommand?: string;
  /** Provider uses GitHub device login instead of token paste. */
  deviceLogin?: boolean;
  /** UI auth mode for subscription flows. */
  subscriptionAuthMode?: 'popup_oauth' | 'device_code' | 'token';
  /** Deprecated compatibility flag for popup OAuth providers. */
  subscriptionOAuth?: boolean;
  /** Provider is subscription-only and should not appear in the API Keys tab. */
  subscriptionOnly?: boolean;
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
    subscriptionOnly: true,
    models: [
      { label: 'Claude Opus 4.6', value: 'copilot/claude-opus-4.6' },
      { label: 'Claude Sonnet 4.6', value: 'copilot/claude-sonnet-4.6' },
      { label: 'Claude Haiku 4.5', value: 'copilot/claude-haiku-4.5' },
      { label: 'GPT-5.4', value: 'copilot/gpt-5.4' },
      { label: 'GPT-5.2 Codex', value: 'copilot/gpt-5.2-codex' },
      { label: 'GPT-5 Mini', value: 'copilot/gpt-5-mini' },
      { label: 'GPT-4.1', value: 'copilot/gpt-4.1' },
      { label: 'GPT-4o', value: 'copilot/gpt-4o' },
      { label: 'GPT-4o Mini', value: 'copilot/gpt-4o-mini' },
      { label: 'Gemini 3.1 Pro', value: 'copilot/gemini-3.1-pro-preview' },
      { label: 'Grok Code Fast 1', value: 'copilot/grok-code-fast-1' },
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
    id: 'minimax',
    name: 'MiniMax',
    color: '#E73562',
    initial: 'Mm',
    subtitle: 'MiniMax M2.5, M1, M2',
    keyPrefix: 'sk-',
    minKeyLength: 30,
    keyPlaceholder: 'sk-...',
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
    initial: 'Oc',
    subtitle: 'DeepSeek, Qwen, Gemma, Llama in the cloud',
    keyPrefix: '',
    minKeyLength: 0,
    keyPlaceholder: '',
    supportsSubscription: true,
    subscriptionOnly: true,
    subscriptionLabel: 'Ollama Cloud subscription',
    subscriptionAuthMode: 'token',
    subscriptionCredentialKind: 'api-key',
    subscriptionKeyPlaceholder: 'Paste your Ollama Cloud API key',
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
    subtitle: 'GLM 5.1, GLM 5, GLM 4.7',
    keyPrefix: '',
    minKeyLength: 30,
    keyPlaceholder: 'API key',
    supportsSubscription: true,
    subscriptionLabel: 'GLM Coding Plan',
    subscriptionAuthMode: 'token',
    subscriptionKeyPlaceholder: 'Paste your Z.ai API key',
    subscriptionCredentialKind: 'api-key',
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

export const SPECIFICITY_STAGES: StageDef[] = [
  {
    id: 'coding',
    step: 1,
    label: 'Coding',
    desc: 'Write, debug, and refactor code.',
  },
  {
    id: 'web_browsing',
    step: 2,
    label: 'Web Browsing',
    desc: 'Navigate pages, search, and extract content.',
  },
  {
    id: 'data_analysis',
    step: 3,
    label: 'Data Analysis',
    desc: 'Crunch numbers, run stats, build charts.',
  },
  {
    id: 'image_generation',
    step: 4,
    label: 'Image Generation',
    desc: 'Create and edit images, logos, visuals.',
  },
  {
    id: 'video_generation',
    step: 5,
    label: 'Video Generation',
    desc: 'Produce clips, animations, and edits.',
  },
  {
    id: 'social_media',
    step: 6,
    label: 'Social Media',
    desc: 'Draft posts, plan content, track engagement.',
  },
  {
    id: 'email_management',
    step: 7,
    label: 'Email',
    desc: 'Compose, reply, and manage your inbox.',
  },
  {
    id: 'calendar_management',
    step: 8,
    label: 'Calendar',
    desc: 'Book meetings, check availability, reschedule.',
  },
  {
    id: 'trading',
    step: 9,
    label: 'Trading',
    desc: 'Analyze markets, place trades, track positions.',
  },
];

/* ── Helpers ── */
export { getProvider, getModelLabel } from './provider-utils.js';
