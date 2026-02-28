import { ManifestConfig } from "./config";
import { PluginLogger } from "./telemetry";
import { verifyConnection } from "./verify";

/* eslint-disable @typescript-eslint/no-explicit-any */
export function registerCommand(
  api: any,
  config: ManifestConfig,
  logger: PluginLogger,
): void {
  if (typeof api.registerCommand !== "function") {
    logger.debug("[manifest] registerCommand not available, skipping /manifest command");
    return;
  }

  const commandHandler = async () => {
    try {
      const check = await verifyConnection(config);
      const lines = [
        `Mode: ${config.mode}`,
        `Endpoint reachable: ${check.endpointReachable ? "yes" : "no"}`,
        `Auth valid: ${check.authValid ? "yes" : "no"}`,
      ];
      if (check.agentName) {
        lines.push(`Agent: ${check.agentName}`);
      }
      if (check.error) {
        lines.push(`Error: ${check.error}`);
      }
      return lines.join("\n");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return `Manifest status check failed: ${msg}`;
    }
  };

  api.registerCommand({
    name: "manifest",
    description: "Show Manifest plugin status and connection info",
    handler: commandHandler,
    execute: commandHandler,
  });

  logger.debug("[manifest] Registered /manifest command");
}
