/**
 * Node Type Definitions
 *
 * This module exports all built-in node types that can be used in flows.
 * Each node type defines its metadata, parameters, and execution logic.
 *
 * Nodes are organized by category:
 * - trigger/: Entry point nodes (UserIntent)
 * - action/: Action nodes (ApiCall)
 * - interface/: UI display nodes (StatCard)
 * - return/: Flow termination nodes (Return, CallFlow)
 * - transform/: Data transformation nodes (JavaScriptCodeTransform)
 */

// Re-export from category subfolders
export { UserIntentNode } from './trigger/index.js';
export { ApiCallNode } from './action/index.js';
export { StatCardNode } from './interface/index.js';
export { ReturnNode, CallFlowNode } from './return/index.js';
export { JavaScriptCodeTransform } from './transform/index.js';

// Import for registry
import { UserIntentNode } from './trigger/index.js';
import { ApiCallNode } from './action/index.js';
import { StatCardNode } from './interface/index.js';
import { ReturnNode, CallFlowNode } from './return/index.js';
import { JavaScriptCodeTransform } from './transform/index.js';
import type { NodeTypeDefinition } from '../types.js';

/**
 * Map of all built-in node types by their type name.
 */
export const builtInNodes: Record<string, NodeTypeDefinition> = {
  UserIntent: UserIntentNode,
  StatCard: StatCardNode,
  Return: ReturnNode,
  CallFlow: CallFlowNode,
  ApiCall: ApiCallNode,
  JavaScriptCodeTransform: JavaScriptCodeTransform,
};

/**
 * Array of all built-in node type definitions.
 */
export const builtInNodeList: NodeTypeDefinition[] = [
  UserIntentNode,
  StatCardNode,
  ReturnNode,
  CallFlowNode,
  ApiCallNode,
  JavaScriptCodeTransform,
];
