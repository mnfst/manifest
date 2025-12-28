import type { LayoutTemplate } from './app.js';
import type { MockData, MockDataEntityDTO } from './mock-data.js';

/**
 * View entity representing a display unit within a flow
 */
export interface View {
  id: string;
  flowId: string;
  name?: string;
  layoutTemplate: LayoutTemplate;
  mockData?: MockDataEntityDTO;
  order: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Request to create a new view
 */
export interface CreateViewRequest {
  name?: string;
  layoutTemplate: LayoutTemplate;
  mockData?: MockData;
}

/**
 * Request to update a view
 */
export interface UpdateViewRequest {
  name?: string;
  layoutTemplate?: LayoutTemplate;
  mockData?: MockData;
}

/**
 * Request to reorder views within a flow
 */
export interface ReorderViewsRequest {
  viewIds: string[];
}

/**
 * Chat request for view modification
 */
export interface ViewChatRequest {
  message: string;
}

/**
 * Chat response for view modification
 */
export interface ViewChatResponse {
  message: string;
  view: View;
}
