import type { View } from './view.js';
import type { App } from './app.js';

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
}

/**
 * Flow entity representing an MCP tool belonging to an app
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
  views?: View[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Request to create a flow with name and description
 * Tool name is auto-generated from name using snake_case conversion
 */
export interface CreateFlowRequest {
  name: string;
  description?: string;
  parameters?: FlowParameter[];
}

/**
 * Request to update a flow
 */
export interface UpdateFlowRequest {
  name?: string;
  description?: string;
  toolName?: string;
  toolDescription?: string;
  whenToUse?: string;
  whenNotToUse?: string;
  isActive?: boolean;
  parameters?: FlowParameter[];
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
