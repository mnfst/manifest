import { useState, useEffect, useCallback, useMemo } from 'react';
import type { NodeInstance, Connection, JSONSchema } from '@manifest/shared';
import { api } from '../lib/api';
import { flattenSchemaProperties } from '../lib/schemaUtils';
import type { UpstreamNodeInfo } from '../types/schema';

interface UseUpstreamNodesOptions {
  /** Flow ID */
  flowId: string;
  /** Current node ID to find upstream nodes for */
  nodeId: string;
  /** Optional pre-loaded nodes (avoids extra API call) */
  nodes?: NodeInstance[];
  /** Optional pre-loaded connections (avoids extra API call) */
  connections?: Connection[];
}

interface UseUpstreamNodesResult {
  /** List of upstream nodes with their output schemas */
  upstreamNodes: UpstreamNodeInfo[];
  /** Loading state */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Refresh the upstream nodes */
  refresh: () => void;
}

/**
 * Find all upstream (ancestor) nodes by traversing the connection graph backward.
 * Uses BFS to find all nodes that can reach the target node.
 */
function findUpstreamNodeIds(
  targetNodeId: string,
  connections: Connection[]
): Set<string> {
  const upstream = new Set<string>();
  const visited = new Set<string>();
  const queue: string[] = [targetNodeId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    // Find all connections where current is the target
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
 * Hook to get all upstream nodes with their output schemas for the "Use Previous Outputs" component.
 *
 * @param options - Configuration options
 * @returns Upstream nodes with their output schemas and flattened fields
 */
export function useUpstreamNodes({
  flowId,
  nodeId,
  nodes: providedNodes,
  connections: providedConnections,
}: UseUpstreamNodesOptions): UseUpstreamNodesResult {
  const [upstreamNodes, setUpstreamNodes] = useState<UpstreamNodeInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Stable node/connection maps from provided data
  const nodeMap = useMemo(() => {
    if (!providedNodes) return null;
    const map = new Map<string, NodeInstance>();
    for (const node of providedNodes) {
      map.set(node.id, node);
    }
    return map;
  }, [providedNodes]);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadUpstreamNodes() {
      setIsLoading(true);
      setError(null);

      try {
        // Use provided data or fetch from API
        let nodes: NodeInstance[];
        let connections: Connection[];

        if (providedNodes && providedConnections) {
          nodes = providedNodes;
          connections = providedConnections;
        } else {
          // Fetch nodes and connections in parallel
          const [fetchedNodes, fetchedConnections] = await Promise.all([
            api.getNodes(flowId),
            api.getConnections(flowId),
          ]);
          nodes = fetchedNodes;
          connections = fetchedConnections;
        }

        if (cancelled) return;

        // Find upstream node IDs using graph traversal
        const upstreamIds = findUpstreamNodeIds(nodeId, connections);

        if (upstreamIds.size === 0) {
          setUpstreamNodes([]);
          setIsLoading(false);
          return;
        }

        // Filter to only upstream nodes
        const upstreamNodeInstances = nodes.filter((n) => upstreamIds.has(n.id));

        // Fetch schemas for all upstream nodes in parallel
        const schemaPromises = upstreamNodeInstances.map(async (node) => {
          try {
            const schemaInfo = await api.getNodeSchema(flowId, node.id);
            return { nodeId: node.id, schema: schemaInfo.outputSchema };
          } catch {
            // If schema fetch fails, return null
            return { nodeId: node.id, schema: null };
          }
        });

        const schemaResults = await Promise.all(schemaPromises);

        if (cancelled) return;

        // Build UpstreamNodeInfo array
        const schemaMap = new Map<string, JSONSchema | null>();
        for (const result of schemaResults) {
          schemaMap.set(result.nodeId, result.schema);
        }

        const result: UpstreamNodeInfo[] = upstreamNodeInstances.map((node) => {
          const outputSchema = schemaMap.get(node.id) ?? null;
          const fields = flattenSchemaProperties(outputSchema);

          return {
            id: node.id,
            slug: node.slug || node.id, // Fallback to id if no slug
            name: node.name,
            type: node.type,
            outputSchema,
            fields,
          };
        });

        // Sort by name for consistent display
        result.sort((a, b) => a.name.localeCompare(b.name));

        setUpstreamNodes(result);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load upstream nodes');
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadUpstreamNodes();

    return () => {
      cancelled = true;
    };
  }, [flowId, nodeId, providedNodes, providedConnections, nodeMap, refreshKey]);

  return {
    upstreamNodes,
    isLoading,
    error,
    refresh,
  };
}
