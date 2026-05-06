import { sendRequest } from '../send';
import type { RunnerContext } from './types';

interface OpenAIConfig {
  baseURL?: string;
  apiKey?: string;
  defaultHeaders?: Record<string, string>;
  organization?: string;
  project?: string;
}

interface ChatCompletionsCreateArgs {
  model: string;
  messages: unknown;
  [k: string]: unknown;
}

const STAINLESS_JS = {
  'User-Agent': 'OpenAI/JS 6.26.0',
  'X-Stainless-Lang': 'js',
  'X-Stainless-Package-Version': '6.26.0',
  'X-Stainless-OS': 'Linux',
  'X-Stainless-Arch': 'x64',
  'X-Stainless-Runtime': 'node',
  'X-Stainless-Runtime-Version': 'v22.17.1',
  'X-Stainless-Retry-Count': '0',
};

function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

/**
 * Drop-in stub for the OpenAI JS SDK. Implements the surface area the
 * generated snippets exercise (`new OpenAI(...).chat.completions.create()`)
 * and routes every call through `sendRequest` so the UI's response panel
 * shows the same payload shape it would for a form-driven send.
 */
export function makeOpenAIStub(ctx: RunnerContext) {
  return class OpenAI {
    config: OpenAIConfig;
    constructor(config: OpenAIConfig = {}) {
      this.config = config;
    }
    chat = {
      completions: {
        create: async (args: ChatCompletionsCreateArgs) => {
          const baseURL = this.config.baseURL || `${trimTrailingSlash(ctx.defaultBaseUrl)}/v1`;
          const url = `${trimTrailingSlash(baseURL)}/chat/completions`;
          const apiKey = this.config.apiKey || ctx.defaultApiKey;
          const headers: Record<string, string> = {
            ...STAINLESS_JS,
            ...(this.config.defaultHeaders || {}),
          };
          if (this.config.organization) headers['OpenAI-Organization'] = this.config.organization;
          if (this.config.project) headers['OpenAI-Project'] = this.config.project;
          const result = await sendRequest({
            url,
            apiKey,
            headers,
            body: args as unknown as Record<string, unknown>,
          });
          ctx.hooks.onResult(result);
          if (!result.ok) {
            const err = new Error(
              result.error || `OpenAI request failed: ${result.status} ${result.statusText}`,
            );
            (err as Error & { status?: number }).status = result.status;
            throw err;
          }
          return result.responseJson;
        },
      },
    };
    // Minimal `responses` shim — uses the same OpenAI-compatible chat
    // endpoint, since Manifest's proxy doesn't expose `/v1/responses` yet.
    responses = {
      create: (args: ChatCompletionsCreateArgs) => this.chat.completions.create(args),
    };
  };
}
