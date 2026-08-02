import { CliError } from './errors';
import { VERSION } from './version';

export interface ClientOptions {
  origin: string;
  apiKey: string;
  fetchImpl: typeof fetch;
  timeoutMs?: number;
}

export interface RequestOptions {
  query?: Record<string, string | undefined>;
  body?: unknown;
}

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Thin HTTP client for the Manifest management API. All paths are relative
 * to `/api/v1`. Failures become CliError with the server's message when one
 * exists — the raw API key never appears in any error.
 */
export class ApiClient {
  constructor(private readonly opts: ClientOptions) {}

  async request(method: string, apiPath: string, options: RequestOptions = {}): Promise<unknown> {
    const url = new URL(`/api/v1${apiPath}`, this.opts.origin);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, value);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);

    let response: Response;
    try {
      response = await this.opts.fetchImpl(url.toString(), {
        method,
        headers: {
          'X-API-Key': this.opts.apiKey,
          'User-Agent': `mnfst-cli/${VERSION}`,
          ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
        signal: controller.signal,
      });
    } catch (error) {
      throw new CliError(
        'network_error',
        `Could not reach ${this.opts.origin}: ${error instanceof Error ? error.message : String(error)}`,
        'Check the URL and that the Manifest server is running',
      );
    } finally {
      clearTimeout(timeout);
    }

    const text = await response.text();
    let parsed: unknown = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = null;
      }
    }

    if (!response.ok) {
      throw this.toError(response.status, parsed);
    }
    return parsed;
  }

  private toError(status: number, body: unknown): CliError {
    const record =
      typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
    // Nest error shape: { statusCode, message: string | string[], error }
    const rawMessage = record['message'];
    const message = Array.isArray(rawMessage)
      ? rawMessage.join('; ')
      : typeof rawMessage === 'string'
        ? rawMessage
        : `Request failed with HTTP ${status}`;
    const code =
      typeof record['error'] === 'string' ? slugify(record['error'] as string) : 'http_error';
    const hint =
      status === 401
        ? 'Run mnfst login, or set MANIFEST_API_KEY'
        : status === 404
          ? 'Check the resource name — see mnfst agent list / mnfst provider list'
          : undefined;
    return new CliError(code, message, hint, status);
  }
}

function slugify(label: string): string {
  return (
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'http_error'
  );
}
