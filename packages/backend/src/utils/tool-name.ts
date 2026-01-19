import { Repository } from 'typeorm';
import { FlowEntity } from '../flow/flow.entity';
import { toSnakeCase } from '@manifest/shared';
import type { UserIntentNodeParameters } from '@manifest/shared';

/**
 * Generate a unique tool name for a UserIntent node within an app.
 * Converts the node name to snake_case and appends a numeric suffix if needed.
 *
 * @param appId - The app ID to check for uniqueness
 * @param nodeName - The display name of the node to convert
 * @param flowRepository - TypeORM repository for flows
 * @param excludeNodeId - Optional node ID to exclude from uniqueness check (for updates)
 * @returns A unique tool name in snake_case format
 */
export async function generateUniqueToolName(
  appId: string,
  nodeName: string,
  flowRepository: Repository<FlowEntity>,
  excludeNodeId?: string
): Promise<string> {
  // Get all flows for this app
  const flows = await flowRepository.find({ where: { appId } });

  // Collect all existing tool names from UserIntent nodes
  const existingNames = new Set<string>();
  for (const flow of flows) {
    for (const node of flow.nodes ?? []) {
      if (node.type === 'UserIntent' && node.id !== excludeNodeId) {
        const params = node.parameters as unknown as UserIntentNodeParameters;
        if (params.toolName) {
          existingNames.add(params.toolName);
        }
      }
    }
  }

  // Convert node name to snake_case
  const baseName = toSnakeCase(nodeName);

  // If base name is not taken, use it
  if (!existingNames.has(baseName)) {
    return baseName;
  }

  // Otherwise, find the next available suffix
  let suffix = 2;
  while (existingNames.has(`${baseName}_${suffix}`)) {
    suffix++;
  }
  return `${baseName}_${suffix}`;
}

/**
 * Check if a tool name already exists within an app.
 *
 * @param appId - The app ID to check
 * @param toolName - The tool name to check
 * @param flowRepository - TypeORM repository for flows
 * @param excludeNodeId - Optional node ID to exclude from check (for updates)
 * @returns True if the tool name already exists
 */
export async function toolNameExists(
  appId: string,
  toolName: string,
  flowRepository: Repository<FlowEntity>,
  excludeNodeId?: string
): Promise<boolean> {
  const flows = await flowRepository.find({ where: { appId } });

  for (const flow of flows) {
    for (const node of flow.nodes ?? []) {
      if (node.type === 'UserIntent' && node.id !== excludeNodeId) {
        const params = node.parameters as unknown as UserIntentNodeParameters;
        if (params.toolName === toolName) {
          return true;
        }
      }
    }
  }

  return false;
}
