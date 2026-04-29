import { toast } from '../toast-store.js';

export const BASE_URL = '/api/v1';

export async function fetchJson<T>(
  path: string,
  params?: Record<string, string | undefined>,
): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`, window.location.origin);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value) url.searchParams.set(key, value);
    }
  }

  // 'default' lets the browser revalidate via ETag / Cache-Control. Backend
  // analytics endpoints set short max-age=10 which keeps stale UI bounded;
  // SSE-driven refetches still bypass cache because they pass a unique signal.
  const res = await fetch(url.toString(), { credentials: 'include', cache: 'default' });
  if (res.status === 401) {
    // Only redirect to /login when the 401 looks like a real session
    // expiry. Per-endpoint 401s (e.g. an endpoint that requires a
    // user-scoped credential when called with a shared API key) shouldn't
    // log the user out.
    const body = await res.text().catch(() => '');
    const looksLikeSessionExpiry =
      !body || /session|cookie|unauthenticated|not authenticated/i.test(body);
    if (looksLikeSessionExpiry) {
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
      throw new Error('Session expired');
    }
    throw new Error(body || 'Unauthorized');
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(body || `API error: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export async function parseErrorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body.message === 'string') return body.message;
    if (Array.isArray(body.message)) return body.message.join(', ');
  } catch {
    // not JSON — fall through
  }
  return `Request failed (${res.status})`;
}

export async function fetchMutate<T = void>(path: string, options: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, { credentials: 'include', ...options });
  if (!res.ok) {
    const message = await parseErrorMessage(res);
    toast.error(message);
    throw new Error(message);
  }
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

/** Build a `/routing/:agent/suffix` path with proper URL-encoding of the agent name. */
export function routingPath(agentName: string, suffix = ''): string {
  const encoded = encodeURIComponent(agentName);
  return suffix
    ? `/routing/${encoded}${suffix.startsWith('/') ? suffix : `/${suffix}`}`
    : `/routing/${encoded}`;
}
