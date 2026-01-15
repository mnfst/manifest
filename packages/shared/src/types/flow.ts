import type { App } from './app.js';
import type { NodeInstance, Connection } from './node.js';

/**
 * Parameter type enum for MCP tool parameters
 */
export type ParameterType = 'string' | 'number' | 'integer' | 'boolean';

/**
 * Parameter definition for an MCP tool flow
 */
export interface FlowParameter {
  name: string;
  type: ParameterType;
  description: string;
  optional: boolean;
  /** When true, parameter cannot be removed or edited by users (system parameter) */
  isSystem?: boolean;
}

/**
 * Flow entity representing a workflow belonging to an app.
 * MCP tools are now derived from UserIntent trigger nodes within the flow.
 * Contains nodes and connections stored as JSON arrays.
 */
export interface Flow {
  id: string;
  appId: string;
  name: string;
  description?: string;
  isActive: boolean;
  /** Node instances within this flow */
  nodes: NodeInstance[];
  /** Connections between nodes */
  connections: Connection[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Flow with computed metadata properties.
 * Used for UI display to show tool information derived from trigger nodes.
 */
export interface FlowWithMeta extends Flow {
  /** Computed: tool names from active UserIntent nodes */
  exposedTools: string[];
  /** Computed: whether flow has any trigger nodes */
  hasTriggers: boolean;
}

/**
 * Request to create a flow with name and description.
 * Tool properties are now set on individual UserIntent trigger nodes.
 */
export interface CreateFlowRequest {
  name: string;
  description?: string;
}

/**
 * Request to update a flow.
 * Tool properties are now set on individual UserIntent trigger nodes.
 */
export interface UpdateFlowRequest {
  name?: string;
  description?: string;
  isActive?: boolean;
}

/**
 * Response from flow generation endpoint
 */
export interface GenerateFlowResponse {
  flow: Flow;
  redirectTo: string;
}

/**
 * Pre-deletion check response for flows
 */
export interface FlowDeletionCheck {
  canDelete: boolean;
  isLastFlow: boolean;
  appIsPublished: boolean;
  warningMessage?: string;
}

/**
 * Response from flow deletion
 */
export interface DeleteFlowResponse {
  success: boolean;
  deletedViewCount: number;
}

/**
 * Flow with parent app data included
 * Used for cross-app flow listings where app context is needed
 */
export interface FlowWithApp extends Flow {
  app: Pick<App, 'id' | 'name' | 'slug'>;
}
