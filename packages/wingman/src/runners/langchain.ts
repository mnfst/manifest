import { sendRequest } from '../send';
import type { RunnerContext } from './types';

interface ChatOpenAIConfig {
  model: string;
  apiKey?: string;
  configuration?: { baseURL?: string };
  defaultHeaders?: Record<string, string>;
}

type LangChainMessage = { role: string; content: string } | string;

function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

function normalizeMessages(input: unknown): Array<{ role: string; content: string }> {
  if (typeof input === 'string') return [{ role: 'user', content: input }];
  if (Array.isArray(input)) {
    return input.map((m: LangChainMessage) => {
      if (typeof m === 'string') return { role: 'user', content: m };
      return { role: m.role || 'user', content: m.content };
    });
  }
  return [];
}

function extractText(json: unknown): string {
  if (!json || typeof json !== 'object') return '';
  const root = json as Record<string, unknown>;
  const choices = root.choices;
  if (Array.isArray(choices) && choices.length > 0) {
    const first = choices[0] as { message?: { content?: unknown } } | undefined;
    if (typeof first?.message?.content === 'string') return first.message.content;
  }
  return '';
}

/**
 * Stub for LangChain's `ChatOpenAI` — covers the `.invoke()` path our
 * generated snippet uses.
 */
export function makeLangChainStub(ctx: RunnerContext) {
  return class ChatOpenAI {
    config: ChatOpenAIConfig;
    constructor(config: ChatOpenAIConfig) {
      this.config = config;
    }
    async invoke(input: unknown) {
      const baseURL =
        this.config.configuration?.baseURL || `${trimTrailingSlash(ctx.defaultBaseUrl)}/v1`;
      const url = `${trimTrailingSlash(baseURL)}/chat/completions`;
      const apiKey = this.config.apiKey || ctx.defaultApiKey;
      const headers: Record<string, string> = {
        'User-Agent': 'langchain-js/0.3.0',
        ...(this.config.defaultHeaders || {}),
      };
      const body: Record<string, unknown> = {
        model: this.config.model,
        messages: normalizeMessages(input),
      };
      const result = await sendRequest({ url, apiKey, headers, body });
      ctx.hooks.onResult(result);
      if (!result.ok) {
        const err = new Error(
          result.error || `ChatOpenAI.invoke failed: ${result.status} ${result.statusText}`,
        );
        (err as Error & { status?: number }).status = result.status;
        throw err;
      }
      return { content: extractText(result.responseJson), response: result.responseJson };
    }
  };
}
