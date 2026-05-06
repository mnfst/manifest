export interface SendInput {
  url: string;
  apiKey: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

export interface SendResult {
  url: string;
  status: number;
  statusText: string;
  ok: boolean;
  durationMs: number;
  requestHeaders: Record<string, string>;
  requestBody: string;
  responseHeaders: Record<string, string>;
  responseBody: string;
  responseJson: unknown | null;
  error?: string;
  errorKind?: 'network' | 'cors' | 'mixed-content' | 'aborted' | 'unknown';
}

const FORBIDDEN_HEADER_PREFIXES = ['proxy-', 'sec-'];
const FORBIDDEN_HEADERS = new Set([
  'accept-charset',
  'accept-encoding',
  'access-control-request-headers',
  'access-control-request-method',
  'connection',
  'content-length',
  'cookie',
  'cookie2',
  'date',
  'dnt',
  'expect',
  'feature-policy',
  'host',
  'keep-alive',
  'origin',
  'referer',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'user-agent',
  'via',
]);

/**
 * Browsers reject some headers (e.g. User-Agent, Sec-*, Host) when set via fetch.
 * Filter them out and surface what was dropped so the UI can warn the user.
 */
export function partitionHeaders(headers: Record<string, string>): {
  allowed: Record<string, string>;
  blocked: string[];
} {
  const allowed: Record<string, string> = {};
  const blocked: string[] = [];
  for (const [key, value] of Object.entries(headers)) {
    const lower = key.toLowerCase();
    const isForbidden =
      FORBIDDEN_HEADERS.has(lower) ||
      FORBIDDEN_HEADER_PREFIXES.some((prefix) => lower.startsWith(prefix));
    if (isForbidden) {
      blocked.push(key);
    } else {
      allowed[key] = value;
    }
  }
  return { allowed, blocked };
}

export async function sendRequest(input: SendInput): Promise<SendResult> {
  const { allowed } = partitionHeaders(input.headers);
  const finalHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...allowed,
  };
  if (input.apiKey) {
    finalHeaders.Authorization = `Bearer ${input.apiKey}`;
  }
  const requestBody = JSON.stringify(input.body, null, 2);

  const start = performance.now();
  try {
    const response = await fetch(input.url, {
      method: 'POST',
      headers: finalHeaders,
      body: requestBody,
    });
    const text = await response.text();
    const durationMs = performance.now() - start;
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });
    let json: unknown | null = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
    return {
      url: input.url,
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      durationMs,
      requestHeaders: finalHeaders,
      requestBody,
      responseHeaders,
      responseBody: text,
      responseJson: json,
    };
  } catch (err) {
    const durationMs = performance.now() - start;
    const message = err instanceof Error ? err.message : String(err);
    return {
      url: input.url,
      status: 0,
      statusText: 'Network error',
      ok: false,
      durationMs,
      requestHeaders: finalHeaders,
      requestBody,
      responseHeaders: {},
      responseBody: '',
      responseJson: null,
      error: message,
      errorKind: classifyError(err, input.url),
    };
  }
}

function classifyError(err: unknown, url: string): SendResult['errorKind'] {
  if (err instanceof DOMException && err.name === 'AbortError') return 'aborted';
  const msg = err instanceof Error ? err.message : String(err);
  // Mixed content: page is HTTPS but the target URL is HTTP
  try {
    if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
      const target = new URL(url);
      if (target.protocol === 'http:') return 'mixed-content';
    }
  } catch {
    /* malformed URL handled below */
  }
  // `TypeError: Failed to fetch` covers DNS, connection refused, AND CORS
  // preflight rejection. We can't distinguish them from JS, so default to
  // "network" — the UI explains both possibilities.
  if (/fetch/i.test(msg) || err instanceof TypeError) return 'network';
  return 'unknown';
}
