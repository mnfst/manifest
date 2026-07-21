/* ── LLM Provider definitions (shared by Routing page) ── */

import { SHARED_PROVIDER_BY_ID, type SharedProviderEntry } from 'manifest-shared';
import { t, type PlainTextMessageKey } from '../i18n/index.js';

export interface SubscriptionEndpointRegion {
  value: string;
  label: string;
  baseUrlPlaceholder?: string;
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
  /** Optional endpoint selector for API-key providers with regional hosts. */
  apiKeyEndpointRegions?: SubscriptionEndpointRegion[];
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
  apiKeyEndpointRegions?: SubscriptionEndpointRegion[];
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
    apiKeyEndpointRegions: [
      { value: 'auto', label: 'Auto-detect' },
      { value: 'beijing', label: 'China (Beijing)' },
      { value: 'singapore', label: 'Singapore' },
      { value: 'us', label: 'United States' },
      {
        value: 'workspace-cn-hongkong',
        label: 'China (Hong Kong)',
        baseUrlPlaceholder:
          'https://<workspace-id>.cn-hongkong.maas.aliyuncs.com/compatible-mode/v1',
      },
      {
        value: 'workspace-eu-central-1',
        label: 'Germany (Frankfurt)',
        baseUrlPlaceholder:
          'https://<workspace-id>.eu-central-1.maas.aliyuncs.com/compatible-mode/v1',
      },
      {
        value: 'workspace-ap-northeast-1',
        label: 'Japan (Tokyo)',
        baseUrlPlaceholder:
          'https://<workspace-id>.ap-northeast-1.maas.aliyuncs.com/compatible-mode/v1',
      },
      {
        value: 'custom',
        label: 'Custom endpoint',
        baseUrlPlaceholder:
          'https://<workspace-id>.eu-central-1.maas.aliyuncs.com/compatible-mode/v1',
      },
    ],
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
  bedrock: {
    initial: 'AWS',
    subtitle: 'Claude, Llama, Mistral, Nova via Amazon Bedrock',
    apiKeyEndpointRegions: [
      { value: 'us-east-1', label: 'US East (N. Virginia)' },
      { value: 'us-east-2', label: 'US East (Ohio)' },
      { value: 'us-west-2', label: 'US West (Oregon)' },
      { value: 'eu-west-1', label: 'Europe (Ireland)' },
      { value: 'eu-west-2', label: 'Europe (London)' },
      { value: 'eu-central-1', label: 'Europe (Frankfurt)' },
      { value: 'eu-south-1', label: 'Europe (Milan)' },
      { value: 'eu-north-1', label: 'Europe (Stockholm)' },
      { value: 'ap-south-1', label: 'Asia Pacific (Mumbai)' },
      { value: 'ap-southeast-2', label: 'Asia Pacific (Sydney)' },
      { value: 'ap-southeast-3', label: 'Asia Pacific (Jakarta)' },
      { value: 'ap-northeast-1', label: 'Asia Pacific (Tokyo)' },
      { value: 'sa-east-1', label: 'South America (Sao Paulo)' },
    ],
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
  cerebras: {
    initial: 'Cb',
    subtitle: 'GPT OSS and GLM on Cerebras inference',
    models: [],
  },
  'cline-pass': {
    initial: 'CP',
    subtitle: 'GLM, Kimi, DeepSeek, MiMo, MiniMax, Qwen via ClinePass',
    supportsSubscription: true,
    subscriptionLabel: 'ClinePass subscription',
    subscriptionAuthMode: 'token',
    subscriptionCredentialKind: 'api-key',
    subscriptionKeyPlaceholder: 'Paste your ClinePass API key',
    subscriptionSignInUrl: 'https://app.cline.bot',
    subscriptionSignInLabel: 'Sign in to ClinePass',
    subscriptionOnly: true,
    models: [],
  },
  pioneer: {
    initial: 'P',
    subtitle: 'OpenAI-compatible inference and fine-tuned Pioneer models',
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
    subtitle: 'Llama, Gemma, Mixtral. Fast inference',
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
    supportsSubscription: true,
    subscriptionLabel: 'Mistral Vibe subscription',
    subscriptionAuthMode: 'token',
    subscriptionCredentialKind: 'api-key',
    subscriptionCredentialName: 'Mistral Vibe',
    subscriptionKeyPlaceholder: 'Paste your Mistral Vibe API key',
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
  nous: {
    initial: 'N',
    subtitle: 'OpenRouter-backed models via NousResearch Portal',
    supportsSubscription: true,
    subscriptionOnly: true,
    subscriptionLabel: 'NousResearch subscription',
    subscriptionAuthMode: 'token',
    subscriptionCredentialKind: 'api-key',
    subscriptionKeyPlaceholder: 'Paste your NousResearch API key',
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

const REGION_MESSAGE_KEYS: Readonly<Record<string, Readonly<Record<string, PlainTextMessageKey>>>> =
  {
    qwen: {
      auto: 'providers.region.auto',
      beijing: 'providers.region.chinaBeijing',
      singapore: 'providers.region.singapore',
      us: 'providers.region.unitedStates',
      'workspace-cn-hongkong': 'providers.region.chinaHongKong',
      'workspace-eu-central-1': 'providers.region.germanyFrankfurt',
      'workspace-ap-northeast-1': 'providers.region.japanTokyo',
      custom: 'providers.region.customEndpoint',
    },
    bedrock: {
      'us-east-1': 'providers.region.usEastVirginia',
      'us-east-2': 'providers.region.usEastOhio',
      'us-west-2': 'providers.region.usWestOregon',
      'eu-west-1': 'providers.region.europeIreland',
      'eu-west-2': 'providers.region.europeLondon',
      'eu-central-1': 'providers.region.europeFrankfurt',
      'eu-south-1': 'providers.region.europeMilan',
      'eu-north-1': 'providers.region.europeStockholm',
      'ap-south-1': 'providers.region.asiaMumbai',
      'ap-southeast-2': 'providers.region.asiaSydney',
      'ap-southeast-3': 'providers.region.asiaJakarta',
      'ap-northeast-1': 'providers.region.asiaTokyo',
      'sa-east-1': 'providers.region.southAmericaSaoPaulo',
    },
    xiaomi: {
      cn: 'providers.region.chinaToken',
      sgp: 'providers.region.singaporeToken',
      ams: 'providers.region.europeToken',
    },
    zai: {
      global: 'providers.region.outsideChina',
      cn: 'providers.region.chinaMainland',
    },
  };

type LocalizedProviderField =
  | 'subtitle'
  | 'subscriptionLabel'
  | 'subscriptionKeyPlaceholder'
  | 'subscriptionRequirementNote'
  | 'subscriptionSignInLabel'
  | 'subscriptionSignInHint';

function providerText(
  providerId: string,
  field: LocalizedProviderField,
  fallback: string | undefined,
): string | undefined {
  if (fallback === undefined) return undefined;
  return t(`providers.${providerId}.${field}` as PlainTextMessageKey);
}

function localizedRegions(
  providerId: string,
  regions: SubscriptionEndpointRegion[] | undefined,
): SubscriptionEndpointRegion[] | undefined {
  if (!regions) return undefined;
  const keys = REGION_MESSAGE_KEYS[providerId];
  return regions.map((region) => ({
    ...region,
    get label() {
      const key = keys?.[region.value];
      return key ? t(key) : region.label;
    },
  }));
}

/** @internal Exported for testing only */
export function buildProviderDef(shared: SharedProviderEntry): ProviderDef {
  const overlay = PROVIDER_UI[shared.id];
  if (!overlay) {
    throw new Error(`Missing UI overlay for shared provider "${shared.id}"`);
  }
  const provider = {
    id: shared.id,
    name: shared.displayName,
    color: shared.color,
    keyPrefix: shared.keyPrefix,
    minKeyLength: shared.minKeyLength,
    keyPlaceholder: shared.keyPlaceholder,
    localOnly: shared.localOnly || undefined,
    ...overlay,
  };
  return {
    ...provider,
    get subtitle() {
      return providerText(shared.id, 'subtitle', overlay.subtitle)!;
    },
    get subscriptionLabel() {
      return providerText(shared.id, 'subscriptionLabel', overlay.subscriptionLabel);
    },
    get subscriptionKeyPlaceholder() {
      return providerText(
        shared.id,
        'subscriptionKeyPlaceholder',
        overlay.subscriptionKeyPlaceholder,
      );
    },
    get subscriptionRequirementNote() {
      return providerText(
        shared.id,
        'subscriptionRequirementNote',
        overlay.subscriptionRequirementNote,
      );
    },
    get subscriptionSignInLabel() {
      return providerText(shared.id, 'subscriptionSignInLabel', overlay.subscriptionSignInLabel);
    },
    get subscriptionSignInHint() {
      return providerText(shared.id, 'subscriptionSignInHint', overlay.subscriptionSignInHint);
    },
    apiKeyEndpointRegions: localizedRegions(shared.id, overlay.apiKeyEndpointRegions),
    subscriptionEndpointRegions: localizedRegions(shared.id, overlay.subscriptionEndpointRegions),
    subscriptionTokenAlternative: overlay.subscriptionTokenAlternative
      ? {
          ...overlay.subscriptionTokenAlternative,
          get dividerLabel() {
            return t(`providers.${shared.id}.dividerLabel` as PlainTextMessageKey);
          },
        }
      : undefined,
  };
}

// Preserve previous ordering (alphabetical-ish by display name) so UI tests
// that index into PROVIDERS don't shift.
const PROVIDER_ORDER = [
  'qwen',
  'anthropic',
  'bedrock',
  'byteplus',
  'cerebras',
  'cline-pass',
  'commandcode',
  'deepseek',
  'fireworks',
  'copilot',
  'gemini',
  'groq',
  'kilo',
  'kiro',
  'llamacpp',
  'lmstudio',
  'minimax',
  'mistral',
  'moonshot',
  'nous',
  'nvidia',
  'ollama',
  'ollama-cloud',
  'openai',
  'opencode-go',
  'opencode-zen',
  'openrouter',
  'pioneer',
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

function localizedStage(id: string, step: number, messageId = id): StageDef {
  return {
    id,
    step,
    get label() {
      return t(`stages.${messageId}.label` as PlainTextMessageKey);
    },
    get desc() {
      return t(`stages.${messageId}.description` as PlainTextMessageKey);
    },
  };
}

export const DEFAULT_STAGE: StageDef = localizedStage('default', 0);

export const STAGES: StageDef[] = [
  localizedStage('simple', 1),
  localizedStage('standard', 2),
  localizedStage('complex', 3),
  localizedStage('reasoning', 4),
];

export const SPECIFICITY_STAGES: StageDef[] = [
  localizedStage('coding', 1),
  localizedStage('web_browsing', 2, 'webBrowsing'),
  localizedStage('data_analysis', 3, 'dataAnalysis'),
  localizedStage('image_generation', 4, 'imageGeneration'),
  localizedStage('video_generation', 5, 'videoGeneration'),
  localizedStage('social_media', 6, 'socialMedia'),
  localizedStage('email_management', 7, 'email'),
  localizedStage('calendar_management', 8, 'calendar'),
  localizedStage('trading', 9),
];

/* ── Helpers ── */
export { getProvider, getModelLabel } from './provider-utils.js';
