import { ManifestConfig } from "./config";

export interface VerifyResult {
  endpointReachable: boolean;
  authValid: boolean;
  agentName: string | null;
  error: string | null;
}

export async function verifyConnection(
  config: ManifestConfig,
): Promise<VerifyResult> {
  const baseUrl = config.endpoint.replace(/\/otlp(\/v1)?\/?$/, "");
  const result: VerifyResult = {
    endpointReachable: false,
    authValid: false,
    agentName: null,
    error: null,
  };

  // Step 1: health check (no auth)
  try {
    const healthRes = await fetch(`${baseUrl}/api/v1/health`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!healthRes.ok) {
      result.error = `Health endpoint returned ${healthRes.status}`;
      return result;
    }
    result.endpointReachable = true;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    result.error = `Cannot reach endpoint: ${msg}`;
    return result;
  }

  // Step 2: auth check (Bearer token)
  try {
    const usageRes = await fetch(
      `${baseUrl}/api/v1/agent/usage?range=24h`,
      {
        headers: { Authorization: `Bearer ${config.apiKey}` },
        signal: AbortSignal.timeout(5000),
      },
    );
    if (usageRes.status === 401 || usageRes.status === 403) {
      result.error = "API key rejected — check your mnfst_ key is correct";
      return result;
    }
    if (!usageRes.ok) {
      result.error = `Usage endpoint returned ${usageRes.status}`;
      return result;
    }
    result.authValid = true;

    const body = (await usageRes.json()) as Record<string, unknown>;
    if (body && typeof body.agentName === "string") {
      result.agentName = body.agentName;
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    result.error = `Auth check failed: ${msg}`;
    return result;
  }

  return result;
}
