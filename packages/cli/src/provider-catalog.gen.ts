// GENERATED FILE — do not edit by hand.
// Source: manifest-shared (SHARED_PROVIDERS + SUPPORTED_SUBSCRIPTION_PROVIDER_IDS).
// Refresh with: npm run gen (runs automatically in npm run build).

export interface ProviderCatalogEntry {
  id: string;
  displayName: string;
  aliases?: readonly string[];
  authTypes: readonly string[];
  keyFormat?: string;
}

export const PROVIDER_CATALOG: readonly ProviderCatalogEntry[] = [
  {
    id: 'qwen',
    displayName: 'Alibaba Cloud',
    aliases: ['alibaba'],
    authTypes: ['api_key', 'subscription'],
    keyFormat: 'sk-...',
  },
  {
    id: 'anthropic',
    displayName: 'Anthropic',
    authTypes: ['api_key', 'subscription'],
    keyFormat: 'sk-ant-...',
  },
  {
    id: 'bedrock',
    displayName: 'AWS Bedrock',
    aliases: ['aws-bedrock', 'aws bedrock', 'amazon-bedrock', 'amazon bedrock'],
    authTypes: ['api_key'],
    keyFormat: 'ABSK...',
  },
  {
    id: 'byteplus',
    displayName: 'BytePlus',
    aliases: ['byteplus-plan', 'byteplus plan', 'modelark', 'modelark-coding-plan'],
    authTypes: ['api_key', 'subscription'],
    keyFormat: 'ModelArk Coding Plan API key',
  },
  {
    id: 'cline-pass',
    displayName: 'ClinePass',
    aliases: ['cline'],
    authTypes: ['subscription'],
  },
  {
    id: 'cerebras',
    displayName: 'Cerebras',
    authTypes: ['api_key'],
    keyFormat: 'Cerebras API key',
  },
  {
    id: 'deepseek',
    displayName: 'DeepSeek',
    authTypes: ['api_key'],
    keyFormat: 'sk-...',
  },
  {
    id: 'fireworks',
    displayName: 'Fireworks AI',
    aliases: ['fireworks-ai', 'fireworks ai', 'fireworksai'],
    authTypes: ['api_key'],
    keyFormat: 'fw_...',
  },
  {
    id: 'groq',
    displayName: 'Groq',
    authTypes: ['api_key'],
    keyFormat: 'gsk_...',
  },
  {
    id: 'huggingface',
    displayName: 'Hugging Face',
    aliases: ['hugging-face', 'hugging face', 'hf'],
    authTypes: ['api_key'],
    keyFormat: 'hf_...',
  },
  {
    id: 'kilo',
    displayName: 'Kilo',
    aliases: ['kilocode', 'kilo-code'],
    authTypes: ['api_key'],
    keyFormat: 'Kilo Gateway API key',
  },
  {
    id: 'copilot',
    displayName: 'GitHub Copilot',
    authTypes: ['subscription'],
  },
  {
    id: 'commandcode',
    displayName: 'Command Code',
    aliases: ['command-code', 'command code', 'cmd'],
    authTypes: ['api_key', 'subscription'],
    keyFormat: 'user_...',
  },
  {
    id: 'gemini',
    displayName: 'Google',
    aliases: ['google'],
    authTypes: ['api_key', 'subscription'],
    keyFormat: 'API key',
  },
  {
    id: 'gemini-free',
    displayName: 'Gemini Free',
    aliases: ['gemini free'],
    authTypes: ['api_key'],
    keyFormat: 'sk-...',
  },
  {
    id: 'kiro',
    displayName: 'Kiro',
    authTypes: ['subscription'],
  },
  {
    id: 'minimax',
    displayName: 'MiniMax',
    authTypes: ['api_key', 'subscription'],
    keyFormat: 'sk-...',
  },
  {
    id: 'xiaomi',
    displayName: 'Xiaomi MiMo',
    aliases: ['mimo', 'xiaomi-mimo', 'xiaomi mimo'],
    authTypes: ['api_key', 'subscription'],
    keyFormat: 'sk-xxxxx',
  },
  {
    id: 'mistral',
    displayName: 'Mistral',
    authTypes: ['api_key', 'subscription'],
    keyFormat: 'API key',
  },
  {
    id: 'moonshot',
    displayName: 'Moonshot',
    aliases: ['kimi'],
    authTypes: ['api_key', 'subscription'],
    keyFormat: 'sk-...',
  },
  {
    id: 'nous',
    displayName: 'NousResearch',
    aliases: ['nousresearch', 'nous-research', 'nous research'],
    authTypes: ['api_key', 'subscription'],
    keyFormat: 'NousResearch API key',
  },
  {
    id: 'nvidia',
    displayName: 'NVIDIA NIM',
    aliases: ['nvidia-nim', 'nvidia nim', 'nvidianim', 'nim'],
    authTypes: ['api_key'],
    keyFormat: 'nvapi-...',
  },
  {
    id: 'llamacpp',
    displayName: 'llama.cpp',
    aliases: ['llama.cpp', 'llama-cpp'],
    authTypes: ['local'],
  },
  {
    id: 'lmstudio',
    displayName: 'LM Studio',
    aliases: ['lm-studio', 'lm studio'],
    authTypes: ['local'],
  },
  {
    id: 'ollama',
    displayName: 'Ollama',
    authTypes: ['local'],
  },
  {
    id: 'ollama-cloud',
    displayName: 'Ollama Cloud',
    authTypes: ['subscription'],
  },
  {
    id: 'openai',
    displayName: 'OpenAI',
    authTypes: ['api_key', 'subscription'],
    keyFormat: 'sk-...',
  },
  {
    id: 'pioneer',
    displayName: 'Pioneer',
    aliases: ['pioneer-ai', 'pioneer ai'],
    authTypes: ['api_key'],
    keyFormat: 'pio_sk_...',
  },
  {
    id: 'opencode-go',
    displayName: 'OpenCode Go',
    aliases: ['opencodego'],
    authTypes: ['api_key', 'subscription'],
  },
  {
    id: 'opencode-zen',
    displayName: 'OpenCode Zen',
    aliases: ['opencodezen'],
    authTypes: ['api_key'],
    keyFormat: 'OpenCode Zen API key',
  },
  {
    id: 'openrouter',
    displayName: 'OpenRouter',
    authTypes: ['api_key'],
    keyFormat: 'sk-or-...',
  },
  {
    id: 'xai',
    displayName: 'xAI',
    authTypes: ['api_key', 'subscription'],
    keyFormat: 'xai-...',
  },
  {
    id: 'zai',
    displayName: 'Z.ai',
    aliases: ['z.ai'],
    authTypes: ['api_key', 'subscription'],
    keyFormat: 'API key',
  },
];
