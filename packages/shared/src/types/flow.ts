import type { View } from './view.js';
import type { App } from './app.js';

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
  views?: View[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Request to create a flow via AI generation
 */
export interface CreateFlowRequest {
  prompt: string;
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
