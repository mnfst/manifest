/* ── LLM Provider definitions (shared by Routing page) ── */

import { SHARED_PROVIDER_BY_ID, type SharedProviderEntry } from 'manifest-shared';

export interface SubscriptionEndpointRegion {
  value: string;
  label: string;
}

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
  /** Provider supports agent-side OAuth/subscription auth (setup-token, OAuth, device-login). */
  supportsSubscription?: boolean;
  /** Label shown in the subscription tab for this provider. */
  subscriptionLabel?: string;
  /** Placeholder for the subscription token input (providers that need a pasted token). */
  subscriptionKeyPlaceholder?: string;
  /** Optional note shown near the subscription credential field. */
  subscriptionRequirementNote?: string;
  /**
   * Credential kind used for subscription auth. Drives the input label and
   * aria-labels in the subscription detail view. Defaults to 'setup-token'
   * for providers that historically used the Anthropic-style setup-token flow.
   */
  subscriptionCredentialKind?: 'setup-token' | 'api-key';
  /** Optional product name used when the subscription credential differs from the provider brand. */
  subscriptionCredentialName?: string;
  /** Instructions text shown in the subscription detail view. */
  subscriptionCommand?: string;
  /** Provider uses GitHub device login instead of token paste. */
  deviceLogin?: boolean;
  /** UI auth mode for subscription flows. */
  subscriptionAuthMode?: 'popup_oauth' | 'popup_paste' | 'device_code' | 'token';
  /** Optional endpoint selector for token-mode subscription providers. */
  subscriptionEndpointRegions?: SubscriptionEndpointRegion[];
  /**
   * Optional secondary subscription path. Lets a provider expose a pasted-token
   * shortcut alongside its primary OAuth/device-code flow — currently used so
   * MiniMax users can connect their Coding Plan via an `sk-cp-` token without
   * going through the device-code popup.
   */
  subscriptionTokenAlternative?: {
    prefix: string;
    placeholder: string;
    dividerLabel: string;
  };
  /** Provider is subscription-only and should not appear in the API Keys tab. */
  subscriptionOnly?: boolean;
  /** External URL the user should open to sign in and retrieve their token (token mode). */
  subscriptionSignInUrl?: string;
  /** Label for the sign-in button shown alongside the token paste field. */
  subscriptionSignInLabel?: string;
  /** Custom instruction text shown above the sign-in button (overrides the default). */
  subscriptionSignInHint?: string;
  /** Show a beta badge next to the provider name. */
  beta?: boolean;
  /**
   * Default port for a local OpenAI-compatible server (LM Studio today).
   * When set, clicking the tile in self-hosted mode opens the
   * LocalServerDetailView, which probes
   * `http://{localLlmHost}:{defaultLocalPort}/v1` and auto-connects the
   * discovered models.
   */
  defaultLocalPort?: number;
}

/** UI-only overlay fields for each provider. The id must match a `SHARED_PROVIDERS` entry. */
interface ProviderUIOverlay {
  initial: string;
  subtitle: string;
  models: { label: string; value: string }[];
  noKeyRequired?: boolean;
  supportsSubscription?: boolean;
  subscriptionLabel?: string;
  subscriptionKeyPlaceholder?: string;
  subscriptionRequirementNote?: string;
  subscriptionCredentialKind?: 'setup-token' | 'api-key';
  subscriptionCredentialName?: string;
  subscriptionCommand?: string;
  deviceLogin?: boolean;
  subscriptionAuthMode?: 'popup_oauth' | 'popup_paste' | 'device_code' | 'token';
  subscriptionEndpointRegions?: SubscriptionEndpointRegion[];
  subscriptionTokenAlternative?: {
    prefix: string;
    placeholder: string;
    dividerLabel: string;
  };
  subscriptionOnly?: boolean;
  subscriptionSignInUrl?: string;
  subscriptionSignInLabel?: string;
  subscriptionSignInHint?: string;
  beta?: boolean;
  /** See ProviderDef.defaultLocalPort. */
  defaultLocalPort?: number;
}

const PROVIDER_UI: Record<string, ProviderUIOverlay> = {
  qwen: {
    initial: 'Al',
    subtitle: 'Qwen, DeepSeek, Kimi, GLM via Alibaba Cloud',
    supportsSubscription: true,
    subscriptionLabel: 'Qwen Token Plan',
    subscriptionAuthMode: 'token',
    subscriptionCredentialKind: 'api-key',
    subscriptionCredentialName: 'Qwen Token Plan',
    subscriptionKeyPlaceholder: 'Paste your Qwen Token Plan API key',
    models: [],
  },
  anthropic: {
    initial: 'A',
    subtitle: 'Claude Opus 4, Sonnet 4.5, Haiku',
    supportsSubscription: true,
    subscriptionLabel: 'Claude Max / Pro subscription',
    subscriptionAuthMode: 'popup_paste',
    models: [],
  },
  byteplus: {
    initial: 'Bp',
    subtitle: 'Ark Code, Seed Code, GLM, Kimi',
    supportsSubscription: true,
    subscriptionOnly: true,
    subscriptionLabel: 'ModelArk Coding Plan',
    subscriptionAuthMode: 'token',
    subscriptionCredentialKind: 'api-key',
    subscriptionCredentialName: 'ModelArk Coding Plan',
    subscriptionKeyPlaceholder: 'Paste your ModelArk Coding Plan API key',
    models: [],
  },
  deepseek: {
    initial: 'D',
    subtitle: 'DeepSeek V3, R1',
    models: [],
  },
  fireworks: {
    initial: 'Fw',
    subtitle: 'DeepSeek, Kimi, Qwen, Llama',
    models: [],
  },
  copilot: {
    initial: 'GH',
    subtitle: 'Claude, GPT, Gemini via Copilot',
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
  commandcode: {
    initial: 'CC',
    subtitle: 'Claude, GPT, Kimi, DeepSeek, Qwen',
    supportsSubscription: true,
    subscriptionOnly: true,
    subscriptionLabel: 'Command Code subscription',
    subscriptionAuthMode: 'token',
    subscriptionCredentialKind: 'api-key',
    subscriptionKeyPlaceholder: 'Paste your Command Code API key',
    subscriptionRequirementNote: 'Requires Command Code Pro or higher.',
    models: [],
  },
  gemini: {
    initial: 'G',
    subtitle: 'Gemini 2.5, Gemini 2.0 Flash',
    supportsSubscription: true,
    subscriptionLabel: 'Sign in with Google',
    subscriptionAuthMode: 'popup_oauth',
    models: [],
  },
  gitlawb: {
    initial: 'gl',
    subtitle: 'MiMo, Gemini, MiniMax, Qwen via gitlawb',
    models: [],
  },
  kiro: {
    initial: 'K',
    subtitle: 'Claude, DeepSeek, MiniMax, GLM, Qwen via Kiro',
    supportsSubscription: true,
    subscriptionLabel: 'Kiro subscription',
    subscriptionAuthMode: 'device_code',
    subscriptionOnly: true,
    beta: true,
    models: [],
  },
  groq: {
    initial: 'Gq',
    subtitle: 'Llama, Gemma, Mixtral — fast inference',
    models: [],
  },
  kilo: {
    initial: 'K',
    subtitle: 'Kilo Gateway unified model access',
    models: [],
  },
  llamacpp: {
    initial: 'Lc',
    subtitle: 'OpenAI-compatible server for GGUF models on CPU / Metal / CUDA',
    noKeyRequired: true,
    models: [],
    defaultLocalPort: 8080,
  },
  lmstudio: {
    initial: 'LM',
    subtitle: 'Run GGUF models with a local server',
    noKeyRequired: true,
    models: [],
    defaultLocalPort: 1234,
  },
  minimax: {
    initial: 'Mm',
    subtitle: 'MiniMax M2.7, M2.5, M1',
    supportsSubscription: true,
    subscriptionLabel: 'MiniMax Coding Plan',
    subscriptionAuthMode: 'device_code',
    subscriptionTokenAlternative: {
      prefix: 'sk-cp-',
      placeholder: 'sk-cp-...',
      dividerLabel: 'Or paste your Coding Plan token',
    },
    models: [],
  },
  xiaomi: {
    initial: 'Mi',
    subtitle: 'MiMo V2.5 Pro, V2.5, Flash',
    supportsSubscription: true,
    subscriptionLabel: 'Xiaomi MiMo Token Plan',
    subscriptionAuthMode: 'token',
    subscriptionCredentialKind: 'api-key',
    subscriptionCredentialName: 'MiMo Token Plan',
    subscriptionKeyPlaceholder: 'Paste your MiMo Token Plan API key',
    subscriptionEndpointRegions: [
      { value: 'cn', label: 'China (token-plan-cn)' },
      { value: 'sgp', label: 'Singapore (token-plan-sgp)' },
      { value: 'ams', label: 'Europe (token-plan-ams)' },
    ],
    models: [],
  },
  mistral: {
    initial: 'M',
    subtitle: 'Mistral Large, Codestral, Pixtral',
    models: [],
  },
  moonshot: {
    initial: 'Mo',
    subtitle: 'Kimi k2, Moonshot v1',
    supportsSubscription: true,
    subscriptionLabel: 'Kimi Coding Plan',
    subscriptionAuthMode: 'token',
    subscriptionCredentialKind: 'api-key',
    subscriptionCredentialName: 'Kimi Code',
    subscriptionKeyPlaceholder: 'Paste your Kimi Code API key',
    models: [],
  },
  nvidia: {
    initial: 'Nv',
    subtitle: 'Nemotron, Llama, Mistral via NVIDIA NIM',
    models: [],
  },
  ollama: {
    initial: 'Ol',
    subtitle: 'Llama, Mistral, Gemma, and more',
    noKeyRequired: true,
    models: [],
  },
  'ollama-cloud': {
    initial: 'Oc',
    subtitle: 'DeepSeek, Qwen, Gemma, Llama in the cloud',
    supportsSubscription: true,
    subscriptionOnly: true,
    subscriptionLabel: 'Ollama Cloud subscription',
    subscriptionAuthMode: 'token',
    subscriptionCredentialKind: 'api-key',
    subscriptionKeyPlaceholder: 'Paste your Ollama Cloud API key',
    models: [],
  },
  openai: {
    initial: 'O',
    subtitle: 'GPT-4o, GPT-4.1, o3, o4',
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
  'opencode-go': {
    initial: 'OG',
    subtitle: 'GLM, Kimi, MiMo, MiniMax',
    supportsSubscription: true,
    subscriptionLabel: 'OpenCode Go (beta)',
    subscriptionAuthMode: 'token',
    subscriptionKeyPlaceholder: 'Paste your OpenCode API key',
    subscriptionSignInUrl: 'https://opencode.ai/auth',
    subscriptionSignInLabel: 'Sign in to OpenCode Go',
    subscriptionSignInHint: 'Sign in to OpenCode Go to get your API key.',
    subscriptionOnly: true,
    beta: true,
    models: [],
  },
  'opencode-zen': {
    initial: 'OZ',
    subtitle: 'Curated Claude, GPT, Gemini, Qwen, GLM, MiniMax',
    models: [],
  },
  openrouter: {
    initial: 'OR',
    subtitle: 'Auto-route to 300+ models',
    models: [],
  },
  xai: {
    initial: 'X',
    subtitle: 'Grok 3, Grok 2',
    supportsSubscription: true,
    subscriptionLabel: 'Grok subscription',
    subscriptionAuthMode: 'popup_oauth',
    models: [],
  },
  zai: {
    initial: 'Z',
    subtitle: 'GLM 5.1, GLM 5, GLM 4.7',
    supportsSubscription: true,
    subscriptionLabel: 'GLM Coding Plan',
    subscriptionAuthMode: 'token',
    subscriptionKeyPlaceholder: 'Paste your Z.ai API key',
    subscriptionCredentialKind: 'api-key',
    subscriptionEndpointRegions: [
      { value: 'global', label: 'Outside China (api.z.ai)' },
      { value: 'cn', label: 'China Mainland (open.bigmodel.cn)' },
    ],
    models: [],
  },
};

/** @internal Exported for testing only */
export function buildProviderDef(shared: SharedProviderEntry): ProviderDef {
  const overlay = PROVIDER_UI[shared.id];
  if (!overlay) {
    throw new Error(`Missing UI overlay for shared provider "${shared.id}"`);
  }
  return {
    id: shared.id,
    name: shared.displayName,
    color: shared.color,
    keyPrefix: shared.keyPrefix,
    minKeyLength: shared.minKeyLength,
    keyPlaceholder: shared.keyPlaceholder,
    localOnly: shared.localOnly || undefined,
    ...overlay,
  };
}

// Preserve previous ordering (alphabetical-ish by display name) so UI tests
// that index into PROVIDERS don't shift.
const PROVIDER_ORDER = [
  'qwen',
  'anthropic',
  'byteplus',
  'commandcode',
  'deepseek',
  'fireworks',
  'copilot',
  'gitlawb',
  'gemini',
  'groq',
  'kilo',
  'kiro',
  'llamacpp',
  'lmstudio',
  'minimax',
  'mistral',
  'moonshot',
  'nvidia',
  'ollama',
  'ollama-cloud',
  'openai',
  'opencode-go',
  'opencode-zen',
  'openrouter',
  'xai',
  'xiaomi',
  'zai',
];

export const PROVIDERS: ProviderDef[] = PROVIDER_ORDER.map((id) => {
  const shared = SHARED_PROVIDER_BY_ID.get(id);
  /* v8 ignore next 3 -- PROVIDER_ORDER is static and must match shared provider metadata. */
  if (!shared) {
    throw new Error(`Unknown provider id in PROVIDER_ORDER: "${id}"`);
  }
  return buildProviderDef(shared);
});

/* ── Pipeline stage definitions ────────────────────── */

export interface StageDef {
  id: string;
  step: number;
  label: string;
  desc: string;
}

export const DEFAULT_STAGE: StageDef = {
  id: 'default',
  step: 0,
  label: 'Default',
  desc: 'Handles every request.',
};

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
