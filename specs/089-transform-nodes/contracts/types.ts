/**
 * Transform Node Type Contracts
 * TypeScript interfaces for the Transform node category
 */

import type { JSONSchema, NodeInstance, Connection, Position } from '@flows-and-nodes/shared';

// =============================================================================
// Node Type Extensions
// =============================================================================

/**
 * Extended NodeType union including transform nodes
 */
export type ExtendedNodeType =
  | 'Interface'
  | 'Return'
  | 'CallFlow'
  | 'UserIntent'
  | 'ApiCall'
  | 'JavaScriptCodeTransform';

/**
 * Extended NodeTypeCategory including transform
 */
export type ExtendedNodeTypeCategory =
  | 'trigger'
  | 'interface'
  | 'action'
  | 'return'
  | 'transform';

// =============================================================================
// JavaScript Code Transform Parameters
// =============================================================================

/**
 * Configuration parameters for JavaScript Code transformer node
 */
export interface JavaScriptCodeTransformParameters {
  /**
   * User-written JavaScript transformation code
   * Must be a valid function body that:
   * - Receives 'input' as parameter
   * - Returns transformed data
   * @default 'return input;'
   */
  code: string;

  /**
   * Inferred output schema from code execution
   * Populated when user tests the transformation
   */
  resolvedOutputSchema: JSONSchema | null;
}

// =============================================================================
// API Request/Response Types
// =============================================================================

/**
 * Request to add a transformer node to a flow
 */
export interface AddTransformerNodeRequest {
  type: 'JavaScriptCodeTransform';
  name: string;
  position: Position;
  parameters?: Partial<JavaScriptCodeTransformParameters>;
}

/**
 * Request to update a transformer node
 */
export interface UpdateTransformerNodeRequest {
  name?: string;
  parameters?: Partial<JavaScriptCodeTransformParameters>;
  position?: Position;
}

/**
 * Request to validate connection compatibility
 */
export interface ValidateConnectionRequest {
  sourceNodeId: string;
  sourceHandle?: string;
  targetNodeId: string;
  targetHandle?: string;
}

/**
 * Result of connection validation with transformer suggestions
 */
export interface ConnectionValidationResult {
  status: 'compatible' | 'warning' | 'error' | 'unknown';
  issues: CompatibilityIssue[];
  suggestedTransformers?: string[];
  sourceSchema: JSONSchema | null;
  targetSchema: JSONSchema | null;
}

/**
 * Specific incompatibility issue between schemas
 */
export interface CompatibilityIssue {
  type: 'missing_field' | 'type_mismatch' | 'format_mismatch' | 'constraint_violation';
  path?: string;
  message: string;
  severity: 'error' | 'warning';
}

/**
 * Request to insert transformer between two nodes
 */
export interface InsertTransformerRequest {
  transformerType: 'JavaScriptCodeTransform';
  sourceNodeId: string;
  targetNodeId: string;
  position?: Position;
}

/**
 * Response after inserting transformer
 */
export interface InsertTransformerResponse {
  transformerNode: NodeInstance;
  connections: [Connection, Connection]; // [source->transformer, transformer->target]
}

/**
 * Request to test transformation code
 */
export interface TestTransformRequest {
  code: string;
  sampleInput: Record<string, unknown>;
}

/**
 * Response from testing transformation
 */
export interface TestTransformResponse {
  success: boolean;
  output?: Record<string, unknown>;
  inferredSchema?: JSONSchema;
  error?: string;
}

// =============================================================================
// Transformer Node Definition Types
// =============================================================================

/**
 * Transform node visual configuration
 */
export interface TransformNodeVisualConfig {
  shape: 'diamond';
  size: number; // pixels (default: 100)
  rotation: number; // degrees (default: 45)
  color: {
    border: string;
    background: string;
    icon: string;
  };
}

/**
 * Default visual configuration for transform nodes
 */
export const TRANSFORM_NODE_VISUAL_CONFIG: TransformNodeVisualConfig = {
  shape: 'diamond',
  size: 100,
  rotation: 45,
  color: {
    border: 'border-teal-300',
    background: 'bg-teal-50',
    icon: 'text-teal-600',
  },
};

// =============================================================================
// Validation Types
// =============================================================================

/**
 * Result of JavaScript code syntax validation
 */
export interface CodeValidationResult {
  valid: boolean;
  errors: CodeValidationError[];
}

/**
 * Syntax error in user code
 */
export interface CodeValidationError {
  line: number;
  column: number;
  message: string;
}

/**
 * Transformer node validation result
 */
export interface TransformerValidationResult {
  hasInputConnection: boolean;
  codeValid: boolean;
  codeErrors: CodeValidationError[];
  canExecute: boolean;
}
