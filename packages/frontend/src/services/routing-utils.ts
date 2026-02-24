import { PROVIDERS } from "./providers.js";

/** Format per-million token price: $0.15 */
export function pricePerM(perToken: number): string {
  const perM = Number(perToken) * 1_000_000;
  if (perM < 0.01) return "$0.00";
  return `$${perM.toFixed(2)}`;
}

/** Map DB provider names to frontend provider IDs */
const PROVIDER_ALIASES: Record<string, string> = {
  google: "gemini",
  alibaba: "qwen",
  moonshot: "moonshot",
  meta: "meta",
  cohere: "cohere",
};

export function resolveProviderId(dbProvider: string): string | undefined {
  const key = dbProvider.toLowerCase();
  const alias = PROVIDER_ALIASES[key];
  return PROVIDERS.find((p) => p.id === key || p.id === alias || p.name.toLowerCase() === key)?.id;
}
