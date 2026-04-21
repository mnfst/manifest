/**
 * First-run setup status check. Cached per page load so the login page,
 * setup page, and any guards can all ask without spamming the endpoint.
 */

export interface LocalServerAvailability {
  vllm: boolean;
  lmstudio: boolean;
  llamacpp: boolean;
}

interface SetupStatusResponse {
  needsSetup: boolean;
  socialProviders?: string[];
  isSelfHosted?: boolean;
  ollamaAvailable?: boolean;
  localLlmHost?: string;
  localServers?: Partial<LocalServerAvailability>;
}

interface SetupStatusResult {
  needsSetup: boolean;
  socialProviders: string[];
  isSelfHosted: boolean;
  ollamaAvailable: boolean;
  localLlmHost: string;
  localServers: LocalServerAvailability;
}

const DEFAULT_LOCAL_SERVERS: LocalServerAvailability = {
  vllm: false,
  lmstudio: false,
  llamacpp: false,
};

let cachedPromise: Promise<SetupStatusResult> | null = null;

async function fetchSetupStatus(): Promise<SetupStatusResult> {
  try {
    const res = await fetch('/api/v1/setup/status', {
      credentials: 'include',
      cache: 'no-store',
    });
    if (!res.ok)
      return {
        needsSetup: false,
        socialProviders: [],
        isSelfHosted: false,
        ollamaAvailable: false,
        localLlmHost: 'localhost',
        localServers: { ...DEFAULT_LOCAL_SERVERS },
      };
    const data = (await res.json()) as SetupStatusResponse;
    return {
      needsSetup: data.needsSetup === true,
      socialProviders: data.socialProviders ?? [],
      isSelfHosted: data.isSelfHosted === true,
      ollamaAvailable: data.ollamaAvailable === true,
      localLlmHost: data.localLlmHost || 'localhost',
      localServers: {
        vllm: data.localServers?.vllm === true,
        lmstudio: data.localServers?.lmstudio === true,
        llamacpp: data.localServers?.llamacpp === true,
      },
    };
  } catch {
    return {
      needsSetup: false,
      socialProviders: [],
      isSelfHosted: false,
      ollamaAvailable: false,
      localLlmHost: 'localhost',
      localServers: { ...DEFAULT_LOCAL_SERVERS },
    };
  }
}

function getSetupStatus(): Promise<SetupStatusResult> {
  if (!cachedPromise) {
    cachedPromise = fetchSetupStatus();
  }
  return cachedPromise;
}

export async function checkNeedsSetup(): Promise<boolean> {
  return (await getSetupStatus()).needsSetup;
}

export async function checkSocialProviders(): Promise<string[]> {
  return (await getSetupStatus()).socialProviders;
}

export async function checkIsSelfHosted(): Promise<boolean> {
  return (await getSetupStatus()).isSelfHosted;
}

export async function checkIsOllamaAvailable(): Promise<boolean> {
  return (await getSetupStatus()).ollamaAvailable;
}

export async function checkLocalLlmHost(): Promise<string> {
  return (await getSetupStatus()).localLlmHost;
}

export async function checkLocalServers(): Promise<LocalServerAvailability> {
  return (await getSetupStatus()).localServers;
}

/** Invalidate the cached status. Call this after a successful setup. */
export function resetSetupStatus(): void {
  cachedPromise = null;
}

export interface CreateAdminInput {
  email: string;
  name: string;
  password: string;
}

export async function createFirstAdmin(input: CreateAdminInput): Promise<void> {
  const res = await fetch('/api/v1/setup/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    let message = `Setup failed (${res.status})`;
    try {
      const body = (await res.json()) as { message?: string | string[] };
      if (typeof body.message === 'string') message = body.message;
      else if (Array.isArray(body.message)) message = body.message.join(', ');
    } catch {
      // not JSON — use default
    }
    throw new Error(message);
  }
  resetSetupStatus();
}
