import { sendRequest } from '../send';
import type { RunnerContext } from './types';

interface VercelOpenAIConfig {
  baseURL?: string;
  apiKey?: string;
  headers?: Record<string, string>;
}

interface VercelModelHandle {
  __config: VercelOpenAIConfig;
  __modelName: string;
}

interface GenerateTextArgs {
  model: VercelModelHandle;
  messages?: Array<{ role: string; content: string }>;
  prompt?: string;
  system?: string;
  [k: string]: unknown;
}

function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
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
 * Stubs `createOpenAI` and `generateText` from the Vercel AI SDK. The
 * generated snippet uses these two named exports — anything else throws a
 * clear error so users know what's stubbed.
 */
export function makeVercelAIStubs(ctx: RunnerContext) {
  const createOpenAI = (config: VercelOpenAIConfig = {}) => {
    return (modelName: string): VercelModelHandle => ({
      __config: config,
      __modelName: modelName,
    });
  };

  const generateText = async (args: GenerateTextArgs) => {
    const cfg = args.model.__config;
    const baseURL = cfg.baseURL || `${trimTrailingSlash(ctx.defaultBaseUrl)}/v1`;
    const url = `${trimTrailingSlash(baseURL)}/chat/completions`;
    const apiKey = cfg.apiKey || ctx.defaultApiKey;
    const messages: Array<{ role: string; content: string }> = [];
    if (args.system) messages.push({ role: 'system', content: args.system });
    if (Array.isArray(args.messages)) messages.push(...args.messages);
    if (args.prompt) messages.push({ role: 'user', content: args.prompt });
    const body: Record<string, unknown> = {
      model: args.model.__modelName,
      messages,
    };
    const headers: Record<string, string> = {
      'User-Agent': 'ai-sdk/5.0.0 (Node.js v22.17.1)',
      ...(cfg.headers || {}),
    };
    const result = await sendRequest({ url, apiKey, headers, body });
    ctx.hooks.onResult(result);
    if (!result.ok) {
      const err = new Error(
        result.error || `generateText failed: ${result.status} ${result.statusText}`,
      );
      (err as Error & { status?: number }).status = result.status;
      throw err;
    }
    return {
      text: extractText(result.responseJson),
      usage: undefined,
      response: result.responseJson,
    };
  };

  // `streamText` is rarely used in our snippets; surface a clear error if
  // someone tries — better than a cryptic undefined-call.
  const streamText = async () => {
    throw new Error(
      'streamText is not stubbed in Wingman yet — switch to generateText to test routing.',
    );
  };

  return { createOpenAI, generateText, streamText };
}
