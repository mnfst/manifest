/**
 * Shared Type Definitions for Nodes Refactor
 *
 * These types will be added to packages/shared/src/types/
 */

// =============================================================================
// Node Instance Types (stored in Flow.nodes JSON column)
// =============================================================================

/**
 * Position on the canvas
 */
export interface Position {
  x: number;
  y: number;
}

/**
 * Base node instance structure stored in Flow.nodes array
 */
export interface NodeInstance {
  id: string;
  type: NodeType;
  name: string;
  position: Position;
  parameters: NodeParameters;
}

/**
 * Supported node types
 */
export type NodeType = 'Interface' | 'Return' | 'CallFlow';

/**
 * Union of all node parameter types
 */
export type NodeParameters =
  | InterfaceNodeParameters
  | ReturnNodeParameters
  | CallFlowNodeParameters;

// =============================================================================
// Interface Node (formerly View)
// =============================================================================

export interface InterfaceNodeParameters {
  layoutTemplate: LayoutTemplate;
  mockData: MockData;
}

export type LayoutTemplate = 'table' | 'post-list';

export type MockData = TableMockData | PostListMockData;

export interface TableMockData {
  type: 'table';
  columns: TableColumn[];
  rows: Record<string, unknown>[];
}

export interface TableColumn {
  key: string;
  header: string;
  type: 'text' | 'number' | 'date' | 'badge' | 'action';
}

export interface PostListMockData {
  type: 'post-list';
  posts: PostItem[];
}

export interface PostItem {
  id: string;
  title: string;
  excerpt: string;
  author?: string;
  date?: string;
  image?: string;
  category?: string;
  tags?: string[];
}

// =============================================================================
// Return Node (formerly ReturnValue)
// =============================================================================

export interface ReturnNodeParameters {
  text: string;
}

// =============================================================================
// CallFlow Node
// =============================================================================

export interface CallFlowNodeParameters {
  targetFlowId: string | null;
}

// =============================================================================
// Connection Types (stored in Flow.connections JSON column)
// =============================================================================

/**
 * Connection between two nodes
 */
export interface Connection {
  id: string;
  sourceNodeId: string;
  sourceHandle: string;
  targetNodeId: string;
  targetHandle: string;
}

// =============================================================================
// Node Type Definition (from nodes package)
// =============================================================================

/**
 * Definition of a node type (exported from @chatgpt-app-builder/nodes)
 */
export interface NodeTypeDefinition {
  name: string;
  displayName: string;
  icon: string;
  group: string[];
  description: string;
  inputs: string[];
  outputs: string[];
  defaultParameters: NodeParameters;
  execute: (context: ExecutionContext) => Promise<ExecutionResult>;
}

/**
 * Context provided to node execute function
 */
export interface ExecutionContext {
  flowId: string;
  nodeId: string;
  parameters: NodeParameters;
  getNodeValue: (nodeId: string) => Promise<unknown>;
  callFlow: (targetFlowId: string, params: Record<string, unknown>) => Promise<unknown>;
}

/**
 * Result returned from node execution
 */
export interface ExecutionResult {
  success: boolean;
  output?: unknown;
  error?: string;
}

// =============================================================================
// API Request/Response Types
// =============================================================================

/**
 * Request to create a new node
 */
export interface CreateNodeRequest {
  type: NodeType;
  name: string;
  position: Position;
  parameters?: Partial<NodeParameters>;
}

/**
 * Request to update an existing node
 */
export interface UpdateNodeRequest {
  name?: string;
  position?: Position;
  parameters?: Partial<NodeParameters>;
}

/**
 * Request to update node position only
 */
export interface UpdatePositionRequest {
  x: number;
  y: number;
}

/**
 * Batch position update item
 */
export interface BatchPositionUpdate {
  nodeId: string;
  position: Position;
}

/**
 * Request to create a connection
 */
export interface CreateConnectionRequest {
  sourceNodeId: string;
  sourceHandle: string;
  targetNodeId: string;
  targetHandle: string;
}

/**
 * Node type info (subset of NodeTypeDefinition for API responses)
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

// =============================================================================
// Flow Entity Updates
// =============================================================================

/**
 * Updated Flow interface with nodes and connections
 */
export interface Flow {
  id: string;
  appId: string;
  name: string;
  description?: string;
  toolName: string;
  toolDescription: string;
  whenToUse?: string;
  whenNotToUse?: string;
  isActive: boolean;
  parameters?: FlowParameter[];
  nodes: NodeInstance[];       // NEW
  connections: Connection[];   // NEW
  createdAt: string;
  updatedAt: string;
}

/**
 * Flow parameter (unchanged from existing)
 */
export interface FlowParameter {
  name: string;
  type: 'string' | 'number' | 'integer' | 'boolean';
  description: string;
  optional: boolean;
}

// =============================================================================
// Type Guards
// =============================================================================

export function isInterfaceNode(node: NodeInstance): node is NodeInstance & { parameters: InterfaceNodeParameters } {
  return node.type === 'Interface';
}

export function isReturnNode(node: NodeInstance): node is NodeInstance & { parameters: ReturnNodeParameters } {
  return node.type === 'Return';
}

export function isCallFlowNode(node: NodeInstance): node is NodeInstance & { parameters: CallFlowNodeParameters } {
  return node.type === 'CallFlow';
}

export function isTableMockData(data: MockData): data is TableMockData {
  return data.type === 'table';
}

export function isPostListMockData(data: MockData): data is PostListMockData {
  return data.type === 'post-list';
}
