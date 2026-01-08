import type { LayoutTemplate } from './app.js';
import type { FlowParameter } from './flow.js';
import type { JSONSchema } from './schema.js';

// =============================================================================
// Position
// =============================================================================

/**
 * Position on the canvas (x, y coordinates).
 */
export interface Position {
  x: number;
  y: number;
}

// =============================================================================
// Node Type Categories
// =============================================================================

/**
 * Classification for node types determining their role in flow execution.
 */
export type NodeTypeCategory = 'trigger' | 'interface' | 'action' | 'return' | 'transform';

// =============================================================================
// Node Types
// =============================================================================

/**
 * Supported node types in the system.
 */
export type NodeType = 'StatCard' | 'Return' | 'CallFlow' | 'UserIntent' | 'ApiCall' | 'JavaScriptCodeTransform';

// =============================================================================
// API Call Node Types
// =============================================================================

/**
 * HTTP methods supported by the ApiCall node.
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

/**
 * A key-value pair representing an HTTP header.
 */
export interface HeaderEntry {
  /** Header name (e.g., 'Content-Type', 'Authorization') */
  key: string;
  /** Header value */
  value: string;
}

/**
 * Input mapping configuration for dynamic API call parameters.
 * Maps upstream node outputs to fields in the API Call configuration.
 */
export interface InputMapping {
  /** ID of the source node to get data from */
  sourceNodeId: string;
  /** Path to extract from source output (e.g., 'data.id', 'result.userId') */
  sourcePath: string;
  /** Which field to set the value in */
  targetField: 'url' | 'header' | 'body';
  /** For headers/body: which key to set (optional for url) */
  targetKey?: string;
}

/**
 * Parameters for an ApiCall node.
 */
export interface ApiCallNodeParameters {
  /** HTTP method for the request */
  method: HttpMethod;
  /** Target URL (may contain template variables like {{nodeId.path}}) */
  url: string;
  /** HTTP headers as key-value pairs */
  headers: HeaderEntry[];
  /** Request timeout in milliseconds (default: 30000) */
  timeout: number;
  /** Mappings from upstream node outputs (for dynamic values) */
  inputMappings: InputMapping[];
  /** Resolved output schema (inferred from sample response) */
  resolvedOutputSchema?: JSONSchema;
}

// =============================================================================
// Node Instance (stored in Flow.nodes JSON column)
// =============================================================================

/**
 * A node instance within a flow.
 * Stored in the Flow.nodes JSON array.
 */
export interface NodeInstance {
  /** Unique identifier within the flow (UUID) */
  id: string;

  /** Human-readable unique identifier for template references (e.g., "weather_trigger", "api_call_1") */
  slug: string;

  /** Node type name (must be a registered node type) */
  type: NodeType;

  /** Display name (unique within the flow) */
  name: string;

  /** Position on the canvas */
  position: Position;

  /** Type-specific configuration parameters */
  parameters: Record<string, unknown>;
}

// =============================================================================
// Connection (stored in Flow.connections JSON column)
// =============================================================================

/**
 * A connection between two nodes.
 * Stored in the Flow.connections JSON array.
 */
export interface Connection {
  /** Unique identifier for this connection (UUID) */
  id: string;

  /** ID of the source node */
  sourceNodeId: string;

  /** Handle identifier on the source node (e.g., 'action:submit', 'right') */
  sourceHandle: string;

  /** ID of the target node */
  targetNodeId: string;

  /** Handle identifier on the target node (e.g., 'left', 'main') */
  targetHandle: string;
}

// =============================================================================
// Node Parameter Types (type-specific parameters for each node type)
// =============================================================================

/**
 * Parameters for a StatCard node.
 */
export interface StatCardNodeParameters {
  /** Layout template type */
  layoutTemplate: LayoutTemplate;
}

/**
 * Parameters for a Return node (formerly ReturnValue).
 */
export interface ReturnNodeParameters {
  /** Text content to return */
  text: string;
}

/**
 * Parameters for a CallFlow node.
 */
export interface CallFlowNodeParameters {
  /** ID of the target flow to invoke (null if unset) */
  targetFlowId: string | null;
}

/**
 * Parameters for a UserIntent trigger node.
 * Each UserIntent node represents an MCP tool entry point.
 */
export interface UserIntentNodeParameters {
  /** Scenarios when AI should use this flow (max 500 chars) */
  whenToUse?: string;

  /** Scenarios when AI should NOT use this flow (max 500 chars) */
  whenNotToUse?: string;

  /** MCP tool identifier (auto-generated from node name in snake_case) */
  toolName: string;

  /** Tool description shown in MCP (max 500 chars) */
  toolDescription: string;

  /** Input parameters for the MCP tool */
  parameters?: FlowParameter[];

  /** Whether this trigger is exposed as an MCP tool (default: true) */
  isActive?: boolean;
}

/**
 * Parameters for a JavaScriptCodeTransform node.
 * Allows users to transform data using custom JavaScript code.
 */
export interface JavaScriptCodeTransformParameters {
  /** User-written JavaScript transformation code */
  code: string;

  /** Inferred output schema from code execution (set when user tests transform) */
  resolvedOutputSchema?: JSONSchema | null;
}

// =============================================================================
// API Request/Response Types
// =============================================================================

/**
 * Request to create a new node in a flow.
 */
export interface CreateNodeRequest {
  /** Node type */
  type: NodeType;

  /** Display name for the node */
  name: string;

  /** Initial position on the canvas */
  position: Position;

  /** Optional initial parameters (defaults applied if not provided) */
  parameters?: Record<string, unknown>;
}

/**
 * Request to update an existing node.
 */
export interface UpdateNodeRequest {
  /** New display name (optional) */
  name?: string;

  /** New position (optional) */
  position?: Position;

  /** Updated parameters (merged with existing) */
  parameters?: Record<string, unknown>;
}

/**
 * Request to update only the position of a node.
 */
export interface UpdateNodePositionRequest {
  x: number;
  y: number;
}

/**
 * Batch position update for multiple nodes.
 */
export interface BatchPositionUpdate {
  nodeId: string;
  position: Position;
}

/**
 * Request to create a new connection.
 */
export interface CreateConnectionRequest {
  sourceNodeId: string;
  sourceHandle: string;
  targetNodeId: string;
  targetHandle: string;
}

/**
 * Request to insert a transformer node between two connected nodes.
 */
export interface InsertTransformerRequest {
  /** ID of the source node in the original connection */
  sourceNodeId: string;

  /** ID of the target node in the original connection */
  targetNodeId: string;

  /** Type of transformer to insert (e.g., 'JavaScriptCodeTransform') */
  transformerType: NodeType;
}

/**
 * Response from inserting a transformer node.
 */
export interface InsertTransformerResponse {
  /** The newly created transformer node */
  transformerNode: NodeInstance;

  /** Connection from original source to transformer */
  sourceConnection: Connection;

  /** Connection from transformer to original target */
  targetConnection: Connection;
}

/**
 * Request to test a JavaScript transform with sample input.
 */
export interface TestTransformRequest {
  /** The JavaScript code to execute */
  code: string;

  /** Sample input data to transform */
  sampleInput: unknown;
}

/**
 * Response from testing a transform.
 */
export interface TestTransformResponse {
  /** Whether the execution was successful */
  success: boolean;

  /** The transformed output (if successful) */
  output?: unknown;

  /** Inferred JSON Schema from the output */
  outputSchema?: JSONSchema;

  /** Error message (if failed) */
  error?: string;

  /** Execution time in milliseconds */
  executionTimeMs?: number;
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Check if a node is a StatCard node.
 */
export function isStatCardNode(
  node: NodeInstance
): node is NodeInstance & { parameters: StatCardNodeParameters } {
  return node.type === 'StatCard';
}

/**
 * Check if a node is a Return node.
 */
export function isReturnNode(
  node: NodeInstance
): node is NodeInstance & { parameters: ReturnNodeParameters } {
  return node.type === 'Return';
}

/**
 * Check if a node is a CallFlow node.
 */
export function isCallFlowNode(
  node: NodeInstance
): node is NodeInstance & { parameters: CallFlowNodeParameters } {
  return node.type === 'CallFlow';
}

/**
 * Check if a node is a UserIntent trigger node.
 */
export function isUserIntentNode(
  node: NodeInstance
): node is NodeInstance & { parameters: UserIntentNodeParameters } {
  return node.type === 'UserIntent';
}

/**
 * Check if a node is an ApiCall node.
 */
export function isApiCallNode(
  node: NodeInstance
): node is NodeInstance & { parameters: ApiCallNodeParameters } {
  return node.type === 'ApiCall';
}

/**
 * Check if a node is a JavaScriptCodeTransform node.
 */
export function isJavaScriptCodeTransformNode(
  node: NodeInstance
): node is NodeInstance & { parameters: JavaScriptCodeTransformParameters } {
  return node.type === 'JavaScriptCodeTransform';
}
