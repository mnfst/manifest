import type {
  App,
  AppWithFlowCount,
  CreateAppRequest,
  UpdateAppRequest,
  DeleteAppResponse,
  GenerateAppRequest,
  ChatRequest,
  ChatResponse,
  PublishResult,
  ApiError,
  Flow,
  FlowWithApp,
  CreateFlowRequest,
  UpdateFlowRequest,
  GenerateFlowResponse,
  FlowDeletionCheck,
  DeleteFlowResponse,
  View,
  CreateViewRequest,
  UpdateViewRequest,
  ViewChatRequest,
  ViewChatResponse,
} from '@chatgpt-app-builder/shared';

/**
 * API base URL - uses Vite proxy in development
 */
const API_BASE = '/api';

/**
 * Backend server URL for MCP endpoints (not proxied)
 * In production, this would come from environment variables
 */
export const BACKEND_URL = 'http://localhost:3001';

/**
 * Custom error class for API errors
 */
export class ApiClientError extends Error {
  constructor(
    message: string,
    public code?: string,
    public status?: number
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

/**
 * Generic fetch wrapper with error handling
 */
async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    let errorData: ApiError = { message: 'An error occurred' };
    try {
      errorData = await response.json();
    } catch {
      // Use default error message
    }
    throw new ApiClientError(errorData.message, errorData.code, response.status);
  }

  return response.json();
}

/**
 * API client for ChatGPT App Builder backend
 */
export const api = {
  // ============================================
  // New App Management APIs
  // ============================================

  /**
   * List all apps with flow counts
   * GET /api/apps
   */
  async listApps(): Promise<AppWithFlowCount[]> {
    return fetchApi<AppWithFlowCount[]>('/apps');
  },

  /**
   * Create a new app
   * POST /api/apps
   */
  async createApp(request: CreateAppRequest): Promise<App> {
    return fetchApi<App>('/apps', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  /**
   * Get app by ID
   * GET /api/apps/:appId
   */
  async getApp(appId: string): Promise<App> {
    return fetchApi<App>(`/apps/${appId}`);
  },

  /**
   * Update an app
   * PATCH /api/apps/:appId
   */
  async updateApp(appId: string, request: UpdateAppRequest): Promise<App> {
    return fetchApi<App>(`/apps/${appId}`, {
      method: 'PATCH',
      body: JSON.stringify(request),
    });
  },

  /**
   * Delete an app and all its flows (cascade delete)
   * DELETE /api/apps/:appId
   */
  async deleteApp(appId: string): Promise<DeleteAppResponse> {
    return fetchApi<DeleteAppResponse>(`/apps/${appId}`, {
      method: 'DELETE',
    });
  },

  /**
   * Publish an app to MCP server
   * POST /api/apps/:appId/publish
   */
  async publishAppById(appId: string): Promise<PublishResult> {
    return fetchApi<PublishResult>(`/apps/${appId}/publish`, {
      method: 'POST',
    });
  },

  // ============================================
  // Flow Management APIs
  // ============================================

  /**
   * List all flows with parent app data
   * GET /api/flows
   * Used by the sidebar Flows page
   */
  async getAllFlows(): Promise<FlowWithApp[]> {
    return fetchApi<FlowWithApp[]>('/flows');
  },

  /**
   * List flows for an app
   * GET /api/apps/:appId/flows
   */
  async listFlows(appId: string): Promise<Flow[]> {
    return fetchApi<Flow[]>(`/apps/${appId}/flows`);
  },

  /**
   * Create a new flow (AI-assisted)
   * POST /api/apps/:appId/flows
   */
  async createFlow(appId: string, request: CreateFlowRequest): Promise<GenerateFlowResponse> {
    return fetchApi<GenerateFlowResponse>(`/apps/${appId}/flows`, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  /**
   * Get flow by ID
   * GET /api/flows/:flowId
   */
  async getFlow(flowId: string): Promise<Flow> {
    return fetchApi<Flow>(`/flows/${flowId}`);
  },

  /**
   * Update a flow
   * PATCH /api/flows/:flowId
   */
  async updateFlow(flowId: string, request: UpdateFlowRequest): Promise<Flow> {
    return fetchApi<Flow>(`/flows/${flowId}`, {
      method: 'PATCH',
      body: JSON.stringify(request),
    });
  },

  /**
   * Check what happens if a flow is deleted
   * GET /api/flows/:flowId/deletion-check
   */
  async checkFlowDeletion(flowId: string): Promise<FlowDeletionCheck> {
    return fetchApi<FlowDeletionCheck>(`/flows/${flowId}/deletion-check`);
  },

  /**
   * Delete a flow
   * DELETE /api/flows/:flowId
   */
  async deleteFlow(flowId: string): Promise<DeleteFlowResponse> {
    return fetchApi<DeleteFlowResponse>(`/flows/${flowId}`, {
      method: 'DELETE',
    });
  },

  // ============================================
  // View Management APIs
  // ============================================

  /**
   * List views for a flow
   * GET /api/flows/:flowId/views
   */
  async listViews(flowId: string): Promise<View[]> {
    return fetchApi<View[]>(`/flows/${flowId}/views`);
  },

  /**
   * Create a new view
   * POST /api/flows/:flowId/views
   */
  async createView(flowId: string, request: CreateViewRequest): Promise<View> {
    return fetchApi<View>(`/flows/${flowId}/views`, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  /**
   * Get view by ID
   * GET /api/views/:viewId
   */
  async getView(viewId: string): Promise<View> {
    return fetchApi<View>(`/views/${viewId}`);
  },

  /**
   * Update a view
   * PATCH /api/views/:viewId
   */
  async updateView(viewId: string, request: UpdateViewRequest): Promise<View> {
    return fetchApi<View>(`/views/${viewId}`, {
      method: 'PATCH',
      body: JSON.stringify(request),
    });
  },

  /**
   * Delete a view
   * DELETE /api/views/:viewId
   */
  async deleteView(viewId: string): Promise<void> {
    await fetchApi<void>(`/views/${viewId}`, {
      method: 'DELETE',
    });
  },

  /**
   * Reorder views within a flow
   * POST /api/flows/:flowId/views/reorder
   */
  async reorderViews(flowId: string, viewIds: string[]): Promise<View[]> {
    return fetchApi<View[]>(`/flows/${flowId}/views/reorder`, {
      method: 'POST',
      body: JSON.stringify({ viewIds }),
    });
  },

  /**
   * Chat with a view for AI-assisted modifications
   * POST /api/views/:viewId/chat
   */
  async chatWithView(viewId: string, request: ViewChatRequest): Promise<ViewChatResponse> {
    return fetchApi<ViewChatResponse>(`/views/${viewId}/chat`, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  // ============================================
  // Legacy APIs (deprecated, for backwards compatibility)
  // ============================================

  /**
   * Generate a new app from a prompt
   * POST /api/generate
   * @deprecated Use createApp + createFlow instead
   */
  async generateApp(request: GenerateAppRequest): Promise<App> {
    return fetchApi<App>('/generate', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  /**
   * Get the current session app
   * GET /api/current
   * @deprecated Use getApp instead
   */
  async getCurrentApp(): Promise<App> {
    return fetchApi<App>('/current');
  },

  /**
   * Send a chat message to customize the app
   * POST /api/chat
   * @deprecated Use view-scoped chat instead
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    return fetchApi<ChatResponse>('/chat', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  /**
   * Publish the current app to MCP server
   * POST /api/publish
   * @deprecated Use publishAppById instead
   */
  async publishApp(): Promise<PublishResult> {
    return fetchApi<PublishResult>('/publish', {
      method: 'POST',
    });
  },
};
