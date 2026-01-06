import type { NodeInstance } from '@chatgpt-app-builder/shared';

/**
 * Context provided to a node's execute function during flow execution.
 */
export interface ExecutionContext {
  /** The ID of the flow being executed */
  flowId: string;
  /** The ID of the current node being executed */
  nodeId: string;
  /** The parameters configured for this node instance */
  parameters: Record<string, unknown>;
  /** Get the output value from a previously executed node */
  getNodeValue: (nodeId: string) => Promise<unknown>;
  /** Call another flow by its ID */
  callFlow: (targetFlowId: string, params: Record<string, unknown>) => Promise<unknown>;
}

/**
 * Result returned from a node's execute function.
 */
export interface ExecutionResult {
  /** Whether the execution was successful */
  success: boolean;
  /** The output data from this node (passed to connected nodes) */
  output?: unknown;
  /** Error message if execution failed */
  error?: string;
}

/**
 * Definition of a node type in the nodes package.
 *
 * Each node type defines its metadata, behavior, and execution logic.
 * Node types are registered in the registry and used by the flow editor
 * and execution engine.
 */
export interface NodeTypeDefinition {
  /** Internal type name (e.g., 'Interface', 'Return', 'CallFlow') */
  name: string;

  /** Human-readable display name (e.g., 'Display Interface') */
  displayName: string;

  /** Lucide icon name for the node (e.g., 'layout-template') */
  icon: string;

  /** Category tags for grouping in the node picker */
  group: string[];

  /** Description of what the node does */
  description: string;

  /** Input handle types (e.g., ['main']) */
  inputs: string[];

  /** Output handle types (e.g., ['main', 'action:submit']) */
  outputs: string[];

  /** Default parameter values for new instances of this node type */
  defaultParameters: Record<string, unknown>;

  /**
   * Execute this node's logic.
   *
   * @param context - The execution context with node data and helper functions
   * @returns A promise resolving to the execution result
   */
  execute: (context: ExecutionContext) => Promise<ExecutionResult>;
}

/**
 * Simplified node type info for API responses (without execute function).
 */
export interface NodeTypeInfo {
  name: string;
  displayName: string;
  icon: string;
  group: string[];
  description: string;
  inputs: string[];
  outputs: string[];
  defaultParameters: Record<string, unknown>;
}

/**
 * Convert a NodeTypeDefinition to NodeTypeInfo (strip execute function).
 */
export function toNodeTypeInfo(definition: NodeTypeDefinition): NodeTypeInfo {
  const { execute, ...info } = definition;
  return info;
}
