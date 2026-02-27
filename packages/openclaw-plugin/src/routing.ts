import { ManifestConfig } from "./config";
import { PluginLogger } from "./telemetry";

interface ResolveResponse {
  tier: string;
  model: string | null;
  provider: string | null;
  confidence: number;
  score: number;
  reason: string;
}

interface MomentumEntry {
  tiers: string[];
  lastUpdated: number;
}

const MOMENTUM_MAX = 5;
const MOMENTUM_TTL_MS = 30 * 60 * 1000; // 30 minutes
const RESOLVE_TIMEOUT_MS = 3000;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// Roles excluded from scoring (system/developer prompts inflate scores)
const SCORING_EXCLUDED_ROLES = new Set(["system", "developer"]);
const SCORING_RECENT_MESSAGES = 10;

/* eslint-disable @typescript-eslint/no-explicit-any */

const momentum = new Map<string, MomentumEntry>();

let cleanupStarted = false;
function ensureCleanupTimer(): void {
  if (cleanupStarted) return;
  cleanupStarted = true;
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of momentum) {
      if (now - entry.lastUpdated > MOMENTUM_TTL_MS) {
        momentum.delete(key);
      }
    }
  }, CLEANUP_INTERVAL_MS);
  if (typeof timer === "object" && "unref" in timer) {
    timer.unref();
  }
}

/**
 * Calls the Manifest resolve endpoint to determine the actual model and tier
 * for a given set of messages. Used from the `agent_end` hook to replace
 * the "auto" model name with the resolved model.
 */
export async function resolveRouting(
  config: ManifestConfig,
  messages: unknown[],
  sessionKey: string,
  logger: PluginLogger,
): Promise<{ tier: string; model: string; provider: string; reason: string } | null> {
  ensureCleanupTimer();

  const baseUrl = config.endpoint.replace(/\/otlp(\/v1)?\/?$/, "");
  const resolveUrl = `${baseUrl}/api/v1/routing/resolve`;

  try {
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      logger.debug("[manifest] Routing resolve: no messages, skipping");
      return null;
    }

    // Strip to only {role, content} — the resolve DTO rejects extra fields.
    // Also exclude system/developer messages and take only recent ones,
    // matching the proxy service's scoring behavior.
    const scoringMessages = messages
      .filter((m: any) => m && typeof m === "object" && "role" in m
        && !SCORING_EXCLUDED_ROLES.has((m as any).role))
      .slice(-SCORING_RECENT_MESSAGES)
      .map((m: any) => ({ role: (m as any).role, content: (m as any).content }));

    if (scoringMessages.length === 0) {
      logger.debug("[manifest] Routing resolve: no scorable messages, skipping");
      return null;
    }

    const entry = momentum.get(sessionKey);
    const recentTiers =
      entry && Date.now() - entry.lastUpdated < MOMENTUM_TTL_MS
        ? entry.tiers
        : undefined;

    const body: Record<string, unknown> = { messages: scoringMessages };
    if (recentTiers) body.recentTiers = recentTiers;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (config.apiKey) {
      headers["Authorization"] = `Bearer ${config.apiKey}`;
    }

    const res = await fetch(resolveUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(RESOLVE_TIMEOUT_MS),
    });

    if (!res.ok) {
      logger.debug(`[manifest] Routing resolve returned ${res.status}`);
      return null;
    }

    const data = (await res.json()) as ResolveResponse;

    if (!data.model) {
      logger.debug(`[manifest] Routing resolve: no model for tier=${data.tier}`);
      return null;
    }

    // Update momentum
    const existing = momentum.get(sessionKey);
    if (existing) {
      existing.tiers = [data.tier, ...existing.tiers].slice(0, MOMENTUM_MAX);
      existing.lastUpdated = Date.now();
    } else {
      momentum.set(sessionKey, {
        tiers: [data.tier],
        lastUpdated: Date.now(),
      });
    }

    logger.debug(
      `[manifest] Routing resolved: tier=${data.tier} model=${data.model} provider=${data.provider}`,
    );

    return {
      tier: data.tier,
      model: data.model,
      provider: data.provider ?? "unknown",
      reason: data.reason ?? "",
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.debug(`[manifest] Routing resolve failed (${msg})`);
    return null;
  }
}

/**
 * Registers Manifest as an OpenAI-compatible provider in OpenClaw.
 * OpenClaw sends `POST /v1/chat/completions` requests to Manifest,
 * which scores, picks the real model, and forwards to the actual provider.
 */
export function registerRouting(
  api: any,
  config: ManifestConfig,
  logger: PluginLogger,
): void {
  if (typeof api.registerProvider !== "function") {
    logger.debug("[manifest] registerProvider not available, skipping provider registration");
    return;
  }

  const baseUrl = config.endpoint.replace(/\/otlp(\/v1)?\/?$/, "");

  try {
    api.registerProvider({
      id: "manifest",
      name: "Manifest Router",
      label: "Manifest Router",
      api: "openai-completions",
      baseUrl,
      apiKey: config.apiKey,
      models: ["auto"],
    });

    logger.info("[manifest] Registered as OpenAI-compatible provider (proxy mode)");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.debug(`[manifest] registerProvider failed (${msg})`);
  }
}
