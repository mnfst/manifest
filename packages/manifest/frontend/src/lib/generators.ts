import type { NodeInstance } from '@manifest/shared';

/**
 * Generate a unique name for a node based on existing nodes.
 * If "Event List" exists, returns "Event List 2", then "Event List 3", etc.
 */
export function generateUniqueName(
  baseName: string,
  existingNodes: NodeInstance[],
): string {
  const existingNames = new Set(existingNodes.map((n) => n.name));

  if (!existingNames.has(baseName)) {
    return baseName;
  }

  let counter = 2;
  while (existingNames.has(`${baseName} ${counter}`)) {
    counter++;
  }
  return `${baseName} ${counter}`;
}
