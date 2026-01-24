import type { NodeTypeCategory, JSONSchema } from '@manifest/shared';

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
  /** Internal type name (e.g., 'RegistryComponent', 'Return', 'CallFlow') */
  name: string;

  /** Human-readable display name (e.g., 'Stat Card') */
  displayName: string;

  /** Lucide icon name for the node (e.g., 'layout-template') */
  icon: string;

  /** Category tags for grouping in the node picker */
  group: string[];

  /** Node type category for classification (trigger, interface, action, return) */
  category: NodeTypeCategory;

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

  // ==========================================================================
  // I/O Schema Declarations (for design-time validation)
  // ==========================================================================

  /**
   * JSON Schema describing the expected input data structure.
   * If undefined, input schema is considered "unknown".
   * For trigger nodes (no inputs), should be null.
   */
  inputSchema?: JSONSchema | null;

  /**
   * JSON Schema describing the guaranteed output data structure.
   * If undefined, output schema is considered "unknown".
   * For Return nodes (no outputs), should be null.
   */
  outputSchema?: JSONSchema | null;

  /**
   * For dynamic input schemas: function to compute schema from node parameters.
   * Takes precedence over static inputSchema when present.
   *
   * @param parameters - The node's configured parameters
   * @returns The computed input schema, or null if unknown
   */
  getInputSchema?: (parameters: Record<string, unknown>) => JSONSchema | null;

  /**
   * For dynamic output schemas: function to compute schema from node parameters.
   * Takes precedence over static outputSchema when present.
   *
   * @param parameters - The node's configured parameters
   * @returns The computed output schema, or null if unknown
   */
  getOutputSchema?: (parameters: Record<string, unknown>) => JSONSchema | null;
}

/**
 * Simplified node type info for API responses (without execute function).
 */
export interface NodeTypeInfo {
  name: string;
  displayName: string;
  icon: string;
  group: string[];
  category: NodeTypeCategory;
  description: string;
  inputs: string[];
  outputs: string[];
  defaultParameters: Record<string, unknown>;

  // Schema info
  inputSchema?: JSONSchema | null;
  outputSchema?: JSONSchema | null;
  hasDynamicInputSchema: boolean;
  hasDynamicOutputSchema: boolean;
}

/**
 * Convert a NodeTypeDefinition to NodeTypeInfo (strip execute function and schema getters).
 */
export function toNodeTypeInfo(definition: NodeTypeDefinition): NodeTypeInfo {
  const {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    execute,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    getInputSchema,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    getOutputSchema,
    inputSchema,
    outputSchema,
    ...rest
  } = definition;

  return {
    ...rest,
    inputSchema,
    outputSchema,
    hasDynamicInputSchema: !!definition.getInputSchema,
    hasDynamicOutputSchema: !!definition.getOutputSchema,
  };
}
