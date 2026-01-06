/**
 * Node Type Definitions
 *
 * This module exports all built-in node types that can be used in flows.
 * Each node type defines its metadata, parameters, and execution logic.
 */

export { InterfaceNode } from './InterfaceNode.js';
export { ReturnNode } from './ReturnNode.js';
export { CallFlowNode } from './CallFlowNode.js';
export { UserIntentNode } from './UserIntentNode.js';
export { ApiCallNode } from './ApiCallNode.js';

import { InterfaceNode } from './InterfaceNode.js';
import { ReturnNode } from './ReturnNode.js';
import { CallFlowNode } from './CallFlowNode.js';
import { UserIntentNode } from './UserIntentNode.js';
import { ApiCallNode } from './ApiCallNode.js';
import type { NodeTypeDefinition } from '../types.js';

/**
 * Map of all built-in node types by their type name.
 */
export const builtInNodes: Record<string, NodeTypeDefinition> = {
  UserIntent: UserIntentNode,
  Interface: InterfaceNode,
  Return: ReturnNode,
  CallFlow: CallFlowNode,
  ApiCall: ApiCallNode,
};

/**
 * Array of all built-in node type definitions.
 */
export const builtInNodeList: NodeTypeDefinition[] = [
  UserIntentNode,
  InterfaceNode,
  ReturnNode,
  CallFlowNode,
  ApiCallNode,
];
