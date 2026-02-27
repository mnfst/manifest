import { ManifestConfig } from "./config";
import { PluginLogger } from "./telemetry";
import { verifyConnection } from "./verify";

const RANGE_MAP: Record<string, string> = {
  today: "24h",
  week: "7d",
  month: "30d",
};

interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
}

async function callApi(
  baseUrl: string,
  path: string,
  apiKey: string,
  logger: PluginLogger,
): Promise<ToolResult> {
  const url = `${baseUrl}${path}`;
  try {
    const headers: Record<string, string> = apiKey
      ? { Authorization: `Bearer ${apiKey}` }
      : {};
    const res = await fetch(url, { headers });
    if (!res.ok) {
      return { content: [{ type: "text", text: JSON.stringify({ error: `API returned ${res.status}` }) }] };
    }
    const data = await res.json();
    return { content: [{ type: "text", text: JSON.stringify(data) }] };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`[manifest] API call failed: ${msg}`);
    return { content: [{ type: "text", text: JSON.stringify({ error: msg }) }] };
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function registerTools(
  api: any,
  config: ManifestConfig,
  logger: PluginLogger,
): void {
  const baseUrl = config.endpoint.replace(/\/otlp(\/v1)?\/?$/, "");

  api.registerTool({
    name: "manifest_usage",
    description:
      "Get token consumption for this agent: total, input, output, " +
      "cache-read tokens, and action count. " +
      "Use when the user asks about token usage or consumption.",
    parameters: {
      type: "object",
      properties: {
        period: {
          type: "string",
          enum: ["today", "week", "month"],
          default: "today",
          description: "Time period",
        },
      },
    },
    async execute(_id: unknown, params: { period?: string }): Promise<ToolResult> {
      const range = RANGE_MAP[params.period || "today"] || "24h";
      return callApi(baseUrl, `/api/v1/agent/usage?range=${range}`, config.apiKey, logger);
    },
  }, { optional: true });

  api.registerTool({
    name: "manifest_costs",
    description:
      "Get cost breakdown for this agent in USD, grouped by model. " +
      "Use when the user asks about costs, spending, or money burned.",
    parameters: {
      type: "object",
      properties: {
        period: {
          type: "string",
          enum: ["today", "week", "month"],
          default: "week",
          description: "Time period",
        },
      },
    },
    async execute(_id: unknown, params: { period?: string }): Promise<ToolResult> {
      const range = RANGE_MAP[params.period || "week"] || "7d";
      return callApi(baseUrl, `/api/v1/agent/costs?range=${range}`, config.apiKey, logger);
    },
  }, { optional: true });

  api.registerTool({
    name: "manifest_health",
    description:
      "Check whether Manifest observability is connected and working. " +
      "Use when the user asks if monitoring is set up or wants a connectivity test.",
    parameters: { type: "object", properties: {} },
    async execute(): Promise<ToolResult> {
      const check = await verifyConnection(config);
      if (check.error) {
        return { content: [{ type: "text", text: JSON.stringify({ error: check.error }) }] };
      }
      return {
        content: [{ type: "text", text: JSON.stringify({
          endpointReachable: check.endpointReachable,
          authValid: check.authValid,
          agentName: check.agentName,
          status: "ok",
        }) }],
      };
    },
  }, { optional: true });

  logger.debug(
    "[manifest] Registered agent tools: manifest_usage, manifest_costs, manifest_health",
  );
}
