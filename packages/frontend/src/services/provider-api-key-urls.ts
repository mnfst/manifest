export const ROUTING_PROVIDER_API_KEY_URLS: Record<string, string> = {
  anthropic: 'https://console.anthropic.com/settings/keys',
  deepseek: 'https://platform.deepseek.com/api_keys',
  gemini: 'https://aistudio.google.com/apikey',
  kimi: 'https://www.kimi.com/code/console',
  minimax: 'https://platform.minimax.io/docs/api-reference/api-overview',
  mistral: 'https://console.mistral.ai/api-keys/',
  moonshot: 'https://platform.moonshot.ai/',
  opencode: 'https://opencode.ai/zen',
  'opencode-go': 'https://opencode.ai/go',
  'ollama-cloud': 'https://ollama.com/settings/keys',
  openai: 'https://platform.openai.com/api-keys',
  openrouter: 'https://openrouter.ai/keys',
  qwen: 'https://www.alibabacloud.com/help/en/model-studio/developer-reference/get-api-key',
  xai: 'https://docs.x.ai/docs/api-reference',
  zai: 'https://z.ai/manage-apikey/apikey-list',
};

export const getRoutingProviderApiKeyUrl = (providerId: string): string | undefined =>
  ROUTING_PROVIDER_API_KEY_URLS[providerId];

export const EMAIL_PROVIDER_API_KEY_URLS: Record<string, string> = {
  resend: 'https://resend.com/api-keys',
  mailgun: 'https://app.mailgun.com/app/account/security/api_keys',
  sendgrid: 'https://app.sendgrid.com/settings/api_keys',
};

export const getEmailProviderApiKeyUrl = (providerId: string): string | undefined =>
  EMAIL_PROVIDER_API_KEY_URLS[providerId];
