import type { LayoutTemplate } from './app.js';

// =============================================================================
// Mock Data Types (moved from mock-data.ts)
// =============================================================================

/**
 * Column definition for table layout
 */
export interface TableColumn {
  key: string;
  header: string;
  type: 'text' | 'number' | 'date' | 'badge' | 'action';
}

/**
 * Mock data structure for 'table' layout
 */
export interface TableMockData {
  type: 'table';
  columns: TableColumn[];
  rows: Array<Record<string, unknown>>;
}

/**
 * Post item for post-list layout
 */
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

/**
 * Mock data structure for 'post-list' layout
 */
export interface PostListMockData {
  type: 'post-list';
  posts: PostItem[];
}

/**
 * Union type for all mock data types
 */
export type MockData = TableMockData | PostListMockData;

/**
 * Type guard for TableMockData
 */
export function isTableMockData(data: MockData): data is TableMockData {
  return data.type === 'table';
}

/**
 * Type guard for PostListMockData
 */
export function isPostListMockData(data: MockData): data is PostListMockData {
  return data.type === 'post-list';
}

/**
 * Default mock data for table layout
 * Designed to work with Manifest UI Table component
 */
export const DEFAULT_TABLE_MOCK_DATA: TableMockData = {
  type: 'table',
  columns: [
    { key: 'id', header: 'ID', type: 'text' },
    { key: 'name', header: 'Name', type: 'text' },
    { key: 'amount', header: 'Amount', type: 'number' },
    { key: 'date', header: 'Date', type: 'date' },
    { key: 'status', header: 'Status', type: 'badge' },
  ],
  rows: [
    { id: '1', name: 'Sample Item 1', amount: 150.00, date: '2025-01-15', status: 'Active' },
    { id: '2', name: 'Sample Item 2', amount: 89.50, date: '2025-01-18', status: 'Pending' },
    { id: '3', name: 'Sample Item 3', amount: 299.99, date: '2025-01-20', status: 'Completed' },
    { id: '4', name: 'Sample Item 4', amount: 45.00, date: '2025-01-22', status: 'Active' },
  ],
};

/**
 * Default mock data for post-list layout
 * Designed to work with Manifest UI BlogPostList component
 */
export const DEFAULT_POST_LIST_MOCK_DATA: PostListMockData = {
  type: 'post-list',
  posts: [
    {
      id: 'post-1',
      title: 'Getting Started with Our Platform',
      excerpt: 'Learn how to get started with our platform and make the most of its features.',
      author: 'Sarah Chen',
      date: '2025-01-15',
      category: 'Tutorial',
      tags: ['getting-started', 'beginner'],
      image: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800',
    },
    {
      id: 'post-2',
      title: 'Best Practices for Success',
      excerpt: 'Discover the best practices for using our tools and achieving your goals.',
      author: 'Alex Rivera',
      date: '2025-01-18',
      category: 'Guide',
      tags: ['tips', 'best-practices'],
      image: 'https://images.unsplash.com/photo-1559028012-481c04fa702d?w=800',
    },
    {
      id: 'post-3',
      title: 'Advanced Features Deep Dive',
      excerpt: 'Take your skills to the next level with our advanced features and techniques.',
      author: 'Jordan Kim',
      date: '2025-01-20',
      category: 'Advanced',
      tags: ['advanced', 'features'],
      image: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800',
    },
  ],
};

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
export type NodeTypeCategory = 'trigger' | 'interface' | 'action' | 'return';

// =============================================================================
// Node Types
// =============================================================================

/**
 * Supported node types in the system.
 */
export type NodeType = 'Interface' | 'Return' | 'CallFlow' | 'UserIntent';

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
 * Parameters for an Interface node (formerly View).
 */
export interface InterfaceNodeParameters {
  /** Layout template type */
  layoutTemplate: LayoutTemplate;

  /** Mock data for the interface */
  mockData: MockData;
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
 */
export interface UserIntentNodeParameters {
  /** Scenarios when AI should use this flow (max 500 chars) */
  whenToUse?: string;

  /** Scenarios when AI should NOT use this flow (max 500 chars) */
  whenNotToUse?: string;
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

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Check if a node is an Interface node.
 */
export function isInterfaceNode(
  node: NodeInstance
): node is NodeInstance & { parameters: InterfaceNodeParameters } {
  return node.type === 'Interface';
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
