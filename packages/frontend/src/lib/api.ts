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
  MockDataEntityDTO,
  UpdateMockDataRequest,
  MockDataChatRequest,
  MockDataChatResponse,
  Connector,
  CreateConnectorRequest,
  UpdateConnectorRequest,
  DeleteConnectorResponse,
  ReturnValue,
  CreateReturnValueRequest,
  UpdateReturnValueRequest,
  CallFlow,
  CreateCallFlowRequest,
  UpdateCallFlowRequest,
  IconUploadResponse,
  ActionConnection,
  CreateActionConnectionRequest,
  UpdateActionConnectionRequest,
} from '@chatgpt-app-builder/shared';

/**
 * API base URL - uses Vite proxy in development
 */
const API_BASE = '/api';

/**
 * Backend server URL for MCP endpoints (not proxied)
 * In production, this would come from environment variables
 */
export const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Resolve icon URL - prepends backend URL for uploaded icons
 * Default icons (in /icons/) are served from frontend, uploads from backend
 */
export function resolveIconUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  // Uploaded icons need backend URL prefix
  if (url.startsWith('/uploads/')) {
    return `${BACKEND_URL}${url}`;
  }
  // Default icons are served from frontend public folder
  return url;
}

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

  // Handle empty responses (e.g., 204 No Content or DELETE requests)
  const contentLength = response.headers.get('content-length');
  if (response.status === 204 || contentLength === '0') {
    return undefined as T;
  }

  // Try to parse JSON, return undefined if empty
  const text = await response.text();
  if (!text) {
    return undefined as T;
  }

  return JSON.parse(text);
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
   * Upload a custom app icon
   * POST /api/apps/:appId/icon
   */
  async uploadAppIcon(appId: string, file: File): Promise<IconUploadResponse> {
    const formData = new FormData();
    formData.append('icon', file);

    const response = await fetch(`${API_BASE}/apps/${appId}/icon`, {
      method: 'POST',
      body: formData,
      // Don't set Content-Type header - browser will set it with boundary for multipart
    });

    if (!response.ok) {
      let errorData: ApiError = { message: 'Upload failed' };
      try {
        errorData = await response.json();
      } catch {
        // Use default error message
      }
      throw new ApiClientError(errorData.message, errorData.code, response.status);
    }

    return response.json();
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
  // Mock Data APIs
  // ============================================

  /**
   * Get mock data by ID
   * GET /api/mock-data/:id
   */
  async getMockData(id: string): Promise<MockDataEntityDTO> {
    return fetchApi<MockDataEntityDTO>(`/mock-data/${id}`);
  },

  /**
   * Get mock data by view ID
   * GET /api/mock-data/view/:viewId
   */
  async getMockDataByViewId(viewId: string): Promise<MockDataEntityDTO> {
    return fetchApi<MockDataEntityDTO>(`/mock-data/view/${viewId}`);
  },

  /**
   * Update mock data directly
   * PUT /api/mock-data/:id
   */
  async updateMockData(id: string, request: UpdateMockDataRequest): Promise<MockDataEntityDTO> {
    return fetchApi<MockDataEntityDTO>(`/mock-data/${id}`, {
      method: 'PUT',
      body: JSON.stringify(request),
    });
  },

  /**
   * Chat with mock data for AI-assisted regeneration
   * POST /api/mock-data/:id/chat
   */
  async chatWithMockData(id: string, request: MockDataChatRequest): Promise<MockDataChatResponse> {
    return fetchApi<MockDataChatResponse>(`/mock-data/${id}/chat`, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  // ============================================
  // Return Value APIs
  // ============================================

  /**
   * List return values for a flow
   * GET /api/flows/:flowId/return-values
   */
  async listReturnValues(flowId: string): Promise<ReturnValue[]> {
    return fetchApi<ReturnValue[]>(`/flows/${flowId}/return-values`);
  },

  /**
   * Create a new return value
   * POST /api/flows/:flowId/return-values
   */
  async createReturnValue(flowId: string, request: CreateReturnValueRequest): Promise<ReturnValue> {
    return fetchApi<ReturnValue>(`/flows/${flowId}/return-values`, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  /**
   * Get return value by ID
   * GET /api/return-values/:returnValueId
   */
  async getReturnValue(returnValueId: string): Promise<ReturnValue> {
    return fetchApi<ReturnValue>(`/return-values/${returnValueId}`);
  },

  /**
   * Update a return value
   * PATCH /api/return-values/:returnValueId
   */
  async updateReturnValue(returnValueId: string, request: UpdateReturnValueRequest): Promise<ReturnValue> {
    return fetchApi<ReturnValue>(`/return-values/${returnValueId}`, {
      method: 'PATCH',
      body: JSON.stringify(request),
    });
  },

  /**
   * Delete a return value
   * DELETE /api/return-values/:returnValueId
   */
  async deleteReturnValue(returnValueId: string): Promise<void> {
    await fetchApi<void>(`/return-values/${returnValueId}`, {
      method: 'DELETE',
    });
  },

  /**
   * Reorder return values within a flow
   * POST /api/flows/:flowId/return-values/reorder
   */
  async reorderReturnValues(flowId: string, orderedIds: string[]): Promise<ReturnValue[]> {
    return fetchApi<ReturnValue[]>(`/flows/${flowId}/return-values/reorder`, {
      method: 'POST',
      body: JSON.stringify({ orderedIds }),
    });
  },

  // ============================================
  // Call Flow APIs
  // ============================================

  /**
   * List call flows for a flow
   * GET /api/flows/:flowId/call-flows
   */
  async listCallFlows(flowId: string): Promise<CallFlow[]> {
    return fetchApi<CallFlow[]>(`/flows/${flowId}/call-flows`);
  },

  /**
   * Create a new call flow
   * POST /api/flows/:flowId/call-flows
   */
  async createCallFlow(flowId: string, request: CreateCallFlowRequest): Promise<CallFlow> {
    return fetchApi<CallFlow>(`/flows/${flowId}/call-flows`, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  /**
   * Get call flow by ID
   * GET /api/call-flows/:callFlowId
   */
  async getCallFlow(callFlowId: string): Promise<CallFlow> {
    return fetchApi<CallFlow>(`/call-flows/${callFlowId}`);
  },

  /**
   * Update a call flow
   * PATCH /api/call-flows/:callFlowId
   */
  async updateCallFlow(callFlowId: string, request: UpdateCallFlowRequest): Promise<CallFlow> {
    return fetchApi<CallFlow>(`/call-flows/${callFlowId}`, {
      method: 'PATCH',
      body: JSON.stringify(request),
    });
  },

  /**
   * Delete a call flow
   * DELETE /api/call-flows/:callFlowId
   */
  async deleteCallFlow(callFlowId: string): Promise<void> {
    await fetchApi<void>(`/call-flows/${callFlowId}`, {
      method: 'DELETE',
    });
  },

  /**
   * Reorder call flows within a flow
   * POST /api/flows/:flowId/call-flows/reorder
   */
  async reorderCallFlows(flowId: string, orderedIds: string[]): Promise<CallFlow[]> {
    return fetchApi<CallFlow[]>(`/flows/${flowId}/call-flows/reorder`, {
      method: 'POST',
      body: JSON.stringify({ orderedIds }),
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

  // ============================================
  // Connector Management APIs
  // ============================================

  /**
   * List all connectors
   * GET /api/connectors
   */
  async listConnectors(): Promise<Connector[]> {
    return fetchApi<Connector[]>('/connectors');
  },

  /**
   * Get connector by ID
   * GET /api/connectors/:id
   */
  async getConnector(id: string): Promise<Connector> {
    return fetchApi<Connector>(`/connectors/${id}`);
  },

  /**
   * Create a new connector
   * POST /api/connectors
   */
  async createConnector(request: CreateConnectorRequest): Promise<Connector> {
    return fetchApi<Connector>('/connectors', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  /**
   * Update a connector
   * PUT /api/connectors/:id
   */
  async updateConnector(id: string, request: UpdateConnectorRequest): Promise<Connector> {
    return fetchApi<Connector>(`/connectors/${id}`, {
      method: 'PUT',
      body: JSON.stringify(request),
    });
  },

  /**
   * Delete a connector
   * DELETE /api/connectors/:id
   */
  async deleteConnector(id: string): Promise<DeleteConnectorResponse> {
    return fetchApi<DeleteConnectorResponse>(`/connectors/${id}`, {
      method: 'DELETE',
    });
  },

  /**
   * Test a connector connection
   * POST /api/connectors/:id/test
   */
  async testConnectorConnection(id: string): Promise<{ success: boolean; message: string }> {
    return fetchApi<{ success: boolean; message: string }>(`/connectors/${id}/test`, {
      method: 'POST',
    });
  },

  /**
   * Test a connection with raw config (before creating)
   * POST /api/connectors/test
   */
  async testConnectionConfig(config: {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
  }): Promise<{ success: boolean; message: string }> {
    return fetchApi<{ success: boolean; message: string }>('/connectors/test', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  },

  // ============================================
  // Action Connection APIs
  // ============================================

  /**
   * List action connections for a view
   * GET /api/views/:viewId/action-connections
   */
  async listActionConnectionsByView(viewId: string): Promise<ActionConnection[]> {
    return fetchApi<ActionConnection[]>(`/views/${viewId}/action-connections`);
  },

  /**
   * List all action connections for a flow (across all views)
   * GET /api/flows/:flowId/action-connections
   */
  async listActionConnectionsByFlow(flowId: string): Promise<ActionConnection[]> {
    return fetchApi<ActionConnection[]>(`/flows/${flowId}/action-connections`);
  },

  /**
   * Create a new action connection
   * POST /api/views/:viewId/action-connections
   */
  async createActionConnection(viewId: string, request: CreateActionConnectionRequest): Promise<ActionConnection> {
    return fetchApi<ActionConnection>(`/views/${viewId}/action-connections`, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  /**
   * Get action connection by view ID and action name
   * GET /api/views/:viewId/action-connections/:actionName
   */
  async getActionConnection(viewId: string, actionName: string): Promise<ActionConnection> {
    return fetchApi<ActionConnection>(`/views/${viewId}/action-connections/${actionName}`);
  },

  /**
   * Update an action connection
   * PUT /api/views/:viewId/action-connections/:actionName
   */
  async updateActionConnection(viewId: string, actionName: string, request: UpdateActionConnectionRequest): Promise<ActionConnection> {
    return fetchApi<ActionConnection>(`/views/${viewId}/action-connections/${actionName}`, {
      method: 'PUT',
      body: JSON.stringify(request),
    });
  },

  /**
   * Delete an action connection
   * DELETE /api/views/:viewId/action-connections/:actionName
   */
  async deleteActionConnection(viewId: string, actionName: string): Promise<void> {
    await fetchApi<void>(`/views/${viewId}/action-connections/${actionName}`, {
      method: 'DELETE',
    });
  },
};
