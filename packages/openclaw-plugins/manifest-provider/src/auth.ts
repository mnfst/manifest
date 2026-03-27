import { API_KEY_PREFIX, DEFAULTS } from './constants';
import type { ProviderAuthContext, ProviderAuthResult } from './types';

const AUTO_MODEL = {
  id: 'auto',
  name: 'Auto Router',
  reasoning: false,
  input: ['text'],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 200000,
  maxTokens: 16384,
};

/**
 * Interactive onboarding flow for `openclaw providers setup manifest`.
 * Prompts the user for their Manifest API key and configures the provider.
 */
export async function runApiKeyAuth(ctx: ProviderAuthContext): Promise<ProviderAuthResult> {
  await ctx.prompter.intro('Manifest — Smart LLM Router');

  await ctx.prompter.note(
    'Manifest analyzes each request and picks the best\n' +
      'model from your connected providers — balancing\n' +
      'quality, speed, and cost automatically.\n\n' +
      'Get your API key at https://app.manifest.build',
    'About Manifest',
  );

  const key = await ctx.prompter.text({
    message: 'Enter your Manifest API key',
    placeholder: `${API_KEY_PREFIX}...`,
    validate: (v) => {
      const trimmed = v?.trim() ?? '';
      if (trimmed.length === 0) return 'API key is required';
      if (!trimmed.startsWith(API_KEY_PREFIX))
        return `Key must start with '${API_KEY_PREFIX}'`;
      return undefined;
    },
  });

  const trimmedKey = key.trim();

  await ctx.prompter.outro(
    'Manifest configured! Use model manifest/auto in your agent config.\n' +
      'Run `openclaw gateway restart` to activate.',
  );

  return {
    profiles: [
      {
        profileId: 'manifest:default',
        credential: { type: 'api_key', provider: 'manifest', key: trimmedKey },
      },
    ],
    configPatch: {
      models: {
        providers: {
          manifest: {
            baseUrl: `${DEFAULTS.ENDPOINT}/v1`,
            api: 'openai-completions',
            models: [AUTO_MODEL],
          },
        },
      },
    },
    defaultModel: 'manifest/auto',
  };
}

/**
 * Static model definition for the "auto" router model.
 * Used by registerProvider() to declare available models.
 */
export function buildModelConfig(baseUrl: string) {
  return {
    baseUrl: `${baseUrl}/v1`,
    api: 'openai-completions' as const,
    models: [AUTO_MODEL],
  };
}
