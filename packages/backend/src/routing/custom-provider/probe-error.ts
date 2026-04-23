/**
 * Classify a probe failure into an actionable error message.
 *
 * `probeModels` hits `{baseUrl}/models` on an operator-provided URL to
 * discover what models a local LLM server exposes. When that fails we
 * want to tell the user WHY in a way they can act on — a bare
 * "fetch failed" or "ECONNREFUSED" is useless without context.
 */
export type ProbeFailureKind =
  | 'connection_refused'
  | 'timeout'
  | 'dns_failure'
  | 'tls_mismatch'
  | 'not_found'
  | 'non_json'
  | 'unauthorized'
  | 'empty_models'
  | 'bad_status'
  | 'unknown';

export interface ProbeError {
  kind: ProbeFailureKind;
  /** Short, user-facing explanation that fits on one line. */
  message: string;
}

interface ClassifyInput {
  url: string;
  /** Caught error from fetch, or null when the server responded but the response was unusable. */
  error?: Error | { name?: string; message?: string; code?: string } | null;
  /** HTTP status code when the server responded but not usefully. */
  status?: number;
  /** Content-Type header when the server returned a non-JSON body. */
  contentType?: string;
  /** True when the response was JSON-parsable but `data` was empty. */
  emptyModels?: boolean;
}

/** Classify a probe failure into a stable kind + actionable message. */
export function classifyProbeError(input: ClassifyInput): ProbeError {
  const { url, error, status, contentType, emptyModels } = input;

  if (emptyModels) {
    return {
      kind: 'empty_models',
      message:
        `${url} is reachable but reports no models. Load a model in your LLM server ` +
        `(LM Studio → My Models, ollama pull) and try again.`,
    };
  }

  if (status !== undefined) {
    if (status === 401 || status === 403) {
      return {
        kind: 'unauthorized',
        message:
          `${url} rejected the request (HTTP ${status}). If your server requires an API ` +
          `key, add it via the Advanced form.`,
      };
    }
    if (status === 404) {
      return {
        kind: 'not_found',
        message:
          `${url} returned 404. The server is up but /v1/models isn't exposed — check ` +
          `that the OpenAI-compatible endpoints are enabled (recent LM Studio / Ollama ` +
          `builds expose them by default).`,
      };
    }
    return {
      kind: 'bad_status',
      message: `${url} returned HTTP ${status}. Check the server logs for details.`,
    };
  }

  if (contentType !== undefined) {
    return {
      kind: 'non_json',
      message:
        `${url} returned ${contentType || 'no content-type'} instead of JSON. ` +
        `Double-check the port and make sure the base URL ends in /v1.`,
    };
  }

  // Node's fetch (undici) wraps network failures as `TypeError: fetch failed`
  // with the real error attached as `.cause`. We check both levels so
  // `ECONNREFUSED` / `ENOTFOUND` / `AbortError` don't fall through to the
  // opaque "unknown" branch.
  const cause = (error as { cause?: unknown } | undefined)?.cause as
    | { code?: string; name?: string; message?: string }
    | undefined;
  const code = (error as { code?: string } | undefined)?.code ?? cause?.code;
  const name = (error as { name?: string } | undefined)?.name ?? cause?.name;
  const directMsg = (error as { message?: string } | undefined)?.message ?? '';
  const causeMsg = cause?.message ?? '';
  const msg = [directMsg, causeMsg].filter(Boolean).join(' | ');

  if (name === 'AbortError') {
    return {
      kind: 'timeout',
      message:
        `No response from ${url} within 5 s. The server may be loading a model — ` +
        `wait a moment and retry.`,
    };
  }
  if (code === 'ECONNREFUSED' || /ECONNREFUSED/i.test(msg)) {
    return {
      kind: 'connection_refused',
      message: `No server is listening on ${url}.\nYou can start it with the command below.`,
    };
  }
  if (code === 'ENOTFOUND' || /ENOTFOUND|getaddrinfo/i.test(msg)) {
    return {
      kind: 'dns_failure',
      message:
        `Could not resolve the hostname in ${url}. Inside Docker use ` +
        `host.docker.internal; natively use localhost.`,
    };
  }
  if (/EPROTO|SSL|TLS|wrong version number/i.test(msg)) {
    return {
      kind: 'tls_mismatch',
      message:
        `${url} isn't speaking TLS. Local LLM servers usually serve plain HTTP — ` +
        `try http:// instead of https://.`,
    };
  }

  return {
    kind: 'unknown',
    message: `Could not reach ${url}: ${msg || 'unknown error'}`,
  };
}
