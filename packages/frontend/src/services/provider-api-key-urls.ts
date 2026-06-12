export const ROUTING_PROVIDER_API_KEY_URLS: Record<string, string> = {
  anthropic: 'https://console.anthropic.com/settings/keys',
  deepseek: 'https://platform.deepseek.com/api_keys',
  fireworks: 'https://app.fireworks.ai/api-keys',
  gemini: 'https://aistudio.google.com/apikey',
  gitlawb: 'https://gitlawb.com/opengateway/dashboard',
  kiro: 'https://app.kiro.dev',
  groq: 'https://console.groq.com/keys',
  kilo: 'https://app.kilo.ai',
  minimax: 'https://platform.minimax.io/user-center/basic-information/interface-key',
  mistral: 'https://console.mistral.ai/api-keys/',
  moonshot: 'https://platform.moonshot.ai/',
  nvidia: 'https://build.nvidia.com/settings/api-keys',
  ollama: 'https://ollama.com/download',
  'ollama-cloud': 'https://ollama.com/settings/keys',
  openai: 'https://platform.openai.com/api-keys',
  'opencode-zen': 'https://opencode.ai/auth',
  openrouter: 'https://openrouter.ai/keys',
  qwen: 'https://www.alibabacloud.com/help/en/model-studio/developer-reference/get-api-key',
  xiaomi: 'https://platform.xiaomimimo.com/console',
  xai: 'https://docs.x.ai/docs/api-reference',
  zai: 'https://z.ai/manage-apikey/apikey-list',
};

export const getRoutingProviderApiKeyUrl = (providerId: string): string | undefined =>
  ROUTING_PROVIDER_API_KEY_URLS[providerId];

/**
 * Where to obtain a subscription token for each subscription-tab provider.
 * Kept separate from the API-key map because the subscription credential
 * often lives behind a different URL than the regular API console (e.g.
 * Anthropic setup-tokens come from the Claude Code CLI, not the API console).
 */
export const SUBSCRIPTION_PROVIDER_KEY_URLS: Record<string, string> = {
  byteplus: 'https://console.byteplus.com/ark/region:ark+ap-southeast-1/apiKey',
  commandcode: 'https://commandcode.ai/studio',
  qwen: 'https://home.qwencloud.com/api-keys',
  moonshot: 'https://www.kimi.com/code/console',
  'ollama-cloud': 'https://ollama.com/settings/keys',
  kiro: 'https://app.kiro.dev',
  xiaomi: 'https://platform.xiaomimimo.com/token-plan',
  zai: 'https://z.ai/manage-apikey/apikey-list',
};

export const getSubscriptionProviderKeyUrl = (providerId: string): string | undefined =>
  SUBSCRIPTION_PROVIDER_KEY_URLS[providerId];

export const EMAIL_PROVIDER_API_KEY_URLS: Record<string, string> = {
  resend: 'https://resend.com/api-keys',
  mailgun: 'https://app.mailgun.com/app/account/security/api_keys',
  sendgrid: 'https://app.sendgrid.com/settings/api_keys',
};

export const getEmailProviderApiKeyUrl = (providerId: string): string | undefined =>
  EMAIL_PROVIDER_API_KEY_URLS[providerId];
