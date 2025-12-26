import type { View } from './view.js';

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
}

/**
 * Response from flow generation endpoint
 */
export interface GenerateFlowResponse {
  flow: Flow;
  redirectTo: string;
}
