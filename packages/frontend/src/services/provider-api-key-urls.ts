export const ROUTING_PROVIDER_API_KEY_URLS: Record<string, string> = {
  anthropic: 'https://console.anthropic.com/settings/keys',
  deepseek: 'https://platform.deepseek.com/api_keys',
  gemini: 'https://aistudio.google.com/apikey',
  minimax: 'https://platform.minimax.io/docs/api-reference/api-overview',
  mistral: 'https://console.mistral.ai/api-keys/',
  moonshot: 'https://platform.moonshot.ai/',
  openai: 'https://platform.openai.com/api-keys',
  openrouter: 'https://openrouter.ai/keys',
  qwen: 'https://www.alibabacloud.com/help/en/model-studio/developer-reference/get-api-key',
  xai: 'https://docs.x.ai/docs/api-reference',
  zai: 'https://z.ai/manage-apikey/apikey-list',
};

export const getRoutingProviderApiKeyUrl = (providerId: string): string | null =>
  ROUTING_PROVIDER_API_KEY_URLS[providerId] ?? null;
