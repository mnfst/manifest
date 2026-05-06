import type { SendResult } from '../send';
import { makeOpenAIStub } from './openai';
import { makeVercelAIStubs } from './vercel-ai';
import { makeLangChainStub } from './langchain';
import type { RunnerContext } from './types';

export interface RunOptions {
  profileId: string;
  code: string;
  baseUrl: string;
  apiKey: string;
}

export interface RunOutput {
  result: SendResult;
  logs: string[];
}

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as new (
  ...args: string[]
) => (...args: unknown[]) => Promise<unknown>;

/**
 * Strip ES module syntax we can't honour at runtime (imports, exports). We
 * replace them with empty lines so source line numbers in error messages
 * still match what the user sees in the editor.
 */
function stripModuleSyntax(code: string): string {
  return code
    .replace(/^\s*import\s+[^;]+;?\s*$/gm, '')
    .replace(/^\s*export\s+default\s+/gm, '')
    .replace(/^\s*export\s+/gm, '');
}

function makeConsoleStub(logs: string[]): Console {
  const fmt = (args: unknown[]) =>
    args
      .map((a) => {
        if (typeof a === 'string') return a;
        try {
          return JSON.stringify(a, null, 2);
        } catch {
          return String(a);
        }
      })
      .join(' ');
  // Cast at the boundary — we don't want every call site to know the stub
  // doesn't implement the full Console surface.
  return {
    log: (...args: unknown[]) => logs.push(fmt(args)),
    info: (...args: unknown[]) => logs.push(fmt(args)),
    warn: (...args: unknown[]) => logs.push('[warn] ' + fmt(args)),
    error: (...args: unknown[]) => logs.push('[error] ' + fmt(args)),
    debug: (...args: unknown[]) => logs.push('[debug] ' + fmt(args)),
  } as unknown as Console;
}

function buildContext(opts: RunOptions, onResult: (r: SendResult) => void): RunnerContext {
  return {
    defaultBaseUrl: opts.baseUrl,
    defaultApiKey: opts.apiKey,
    hooks: { onResult },
  };
}

/**
 * Build the global bindings for a given profile. Each profile gets its own
 * set so error messages in unrelated SDKs read cleanly.
 */
function buildGlobals(profileId: string, ctx: RunnerContext): Record<string, unknown> | null {
  switch (profileId) {
    case 'openai-sdk':
      return { OpenAI: makeOpenAIStub(ctx) };
    case 'vercel-ai-sdk':
      return makeVercelAIStubs(ctx);
    case 'langchain': {
      const ChatOpenAI = makeLangChainStub(ctx);
      return { ChatOpenAI };
    }
    case 'raw':
      // Plain fetch — no stubs needed; the runtime fetch is intercepted by
      // sendRequest equivalent only via the user's own code, so let it run
      // against the global fetch directly. We still capture the result by
      // wrapping fetch.
      return { fetch: makeFetchInterceptor(ctx) };
    default:
      return null;
  }
}

function makeFetchInterceptor(ctx: RunnerContext) {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const start = performance.now();
    const realUrl = typeof input === 'string' ? input : input.toString();
    const headers: Record<string, string> = {};
    if (init?.headers) {
      const h = new Headers(init.headers);
      h.forEach((v, k) => (headers[k] = v));
    }
    let body = '';
    if (typeof init?.body === 'string') body = init.body;
    const response = await fetch(input, init);
    const text = await response.clone().text();
    const respHeaders: Record<string, string> = {};
    response.headers.forEach((v, k) => (respHeaders[k] = v));
    let json: unknown = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* keep as text */
    }
    ctx.hooks.onResult({
      url: realUrl,
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      durationMs: performance.now() - start,
      requestHeaders: headers,
      requestBody: body,
      responseHeaders: respHeaders,
      responseBody: text,
      responseJson: json,
    });
    // Return a fresh response so user code can still call .json() etc.
    return new Response(text, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  };
}

export function isExecutable(profileId: string, lang: string): boolean {
  if (lang !== 'typescript' && lang !== 'bash') return false;
  if (lang === 'bash' && profileId !== 'raw') return false;
  return ['openai-sdk', 'vercel-ai-sdk', 'langchain', 'raw'].includes(profileId);
}

export async function runUserCode(opts: RunOptions): Promise<RunOutput> {
  const logs: string[] = [];
  const captured: SendResult[] = [];
  const ctx = buildContext(opts, (r) => captured.push(r));
  const globals = buildGlobals(opts.profileId, ctx);
  if (!globals) {
    throw new Error(`No runner registered for profile "${opts.profileId}".`);
  }
  const consoleStub = makeConsoleStub(logs);
  const stripped = stripModuleSyntax(opts.code);

  const argNames = ['console', ...Object.keys(globals)];
  const argValues: unknown[] = [consoleStub, ...Object.values(globals)];

  let fn: (...args: unknown[]) => Promise<unknown>;
  try {
    fn = new AsyncFunction(...argNames, stripped);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Could not parse code: ${msg}`);
  }

  try {
    await fn(...argValues);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (captured.length === 0) {
      throw new Error(msg);
    }
    // The fetch went through but the user's code threw afterward (e.g. a
    // JSON-shape assumption). Surface both: keep the captured result, append
    // the error to the logs.
    logs.push(`[error] ${msg}`);
  }

  if (captured.length === 0) {
    throw new Error(
      'Code ran but no request was made. Make sure your code calls the SDK (e.g. client.chat.completions.create).',
    );
  }
  return { result: captured[captured.length - 1]!, logs };
}
