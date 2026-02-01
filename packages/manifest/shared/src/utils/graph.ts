/**
 * Minimal connection interface for graph traversal utilities.
 * Compatible with the full Connection type from types/node.ts.
 */
interface GraphConnection {
  sourceNodeId: string;
  targetNodeId: string;
}

/**
 * Check if adding a connection from sourceId to targetId would create a cycle.
 * Uses DFS to detect if there's a path from targetId back to sourceId.
 */
export function wouldCreateCycle(
  sourceId: string,
  targetId: string,
  connections: GraphConnection[],
): boolean {
  const visited = new Set<string>();
  const stack = [targetId];

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === sourceId) return true;
    if (visited.has(current)) continue;
    visited.add(current);

    for (const conn of connections) {
      if (conn.sourceNodeId === current) {
        stack.push(conn.targetNodeId);
      }
    }
  }
  return false;
}

/**
 * Find all upstream (ancestor) node IDs by traversing connections backward.
 * Uses BFS to find all nodes that can reach the target node.
 */
export function findUpstreamNodeIds(
  targetNodeId: string,
  connections: GraphConnection[],
): Set<string> {
  const upstream = new Set<string>();
  const visited = new Set<string>();
  const queue: string[] = [targetNodeId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    for (const conn of connections) {
      if (conn.targetNodeId === current) {
        const sourceId = conn.sourceNodeId;
        if (!visited.has(sourceId)) {
          upstream.add(sourceId);
          queue.push(sourceId);
        }
      }
    }
  }

  return upstream;
}

/**
 * Find all downstream (descendant) node IDs by traversing connections forward.
 * Uses BFS to find all nodes reachable from the source node.
 */
export function findDownstreamNodeIds(
  sourceNodeId: string,
  connections: GraphConnection[],
): Set<string> {
  const downstream = new Set<string>();
  const visited = new Set<string>();
  const queue: string[] = [sourceNodeId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    for (const conn of connections) {
      if (conn.sourceNodeId === current) {
        const targetId = conn.targetNodeId;
        if (!visited.has(targetId)) {
          downstream.add(targetId);
          queue.push(targetId);
        }
      }
    }
  }

  return downstream;
}
