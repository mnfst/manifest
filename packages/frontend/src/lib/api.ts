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
  Connector,
  CreateConnectorRequest,
  UpdateConnectorRequest,
  DeleteConnectorResponse,
  IconUploadResponse,
  // Node/Connection types (new unified node architecture)
  NodeInstance,
  Connection,
  CreateNodeRequest,
  UpdateNodeRequest,
  UpdateNodePositionRequest,
  CreateConnectionRequest,
  NodeTypeCategory,
  InsertTransformerRequest,
  InsertTransformerResponse,
  TestTransformRequest,
  TestTransformResponse,
  // Execution types
  ExecutionStatus,
  ExecutionListResponse,
  FlowExecution,
  // Chat preview types
  ValidateKeyResponse,
  ModelListResponse,
  PreviewChatRequest,
  ChatStreamEvent,
  // Schema types
  NodeSchemaInfo,
  NodeTypeSchemaResponse,
  ValidateConnectionRequest,
  ValidateConnectionResponse,
  ResolveSchemaRequest,
  ResolveSchemaResponse,
  FlowValidationResponse,
  FlowSchemasResponse,
} from '@chatgpt-app-builder/shared';

/**
 * Node type info returned by GET /api/node-types
 */
export interface NodeTypeInfo {
  name: string;
  displayName: string;
  icon: string;
  group: string[];
  category: NodeTypeCategory;
  description: string;
  inputs: string[];
  outputs: string[];
  defaultParameters: Record<string, unknown>;
}

/**
 * Category info for grouping nodes in the UI
 */
export interface CategoryInfo {
  id: NodeTypeCategory;
  displayName: string;
  order: number;
}

/**
 * Response from GET /api/node-types
 */
export interface NodeTypesResponse {
  nodeTypes: NodeTypeInfo[];
  categories: CategoryInfo[];
}

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
  // Node Management APIs (new unified architecture)
  // ============================================

  /**
   * Get all available node types with metadata
   * GET /api/node-types
   */
  async getNodeTypes(): Promise<NodeTypesResponse> {
    return fetchApi<NodeTypesResponse>('/node-types');
  },

  /**
   * Get all nodes in a flow
   * GET /api/flows/:flowId/nodes
   */
  async getNodes(flowId: string): Promise<NodeInstance[]> {
    return fetchApi<NodeInstance[]>(`/flows/${flowId}/nodes`);
  },

  /**
   * Create a new node in a flow
   * POST /api/flows/:flowId/nodes
   */
  async createNode(flowId: string, request: CreateNodeRequest): Promise<NodeInstance> {
    return fetchApi<NodeInstance>(`/flows/${flowId}/nodes`, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  /**
   * Update a node
   * PATCH /api/flows/:flowId/nodes/:nodeId
   */
  async updateNode(flowId: string, nodeId: string, request: UpdateNodeRequest): Promise<NodeInstance> {
    return fetchApi<NodeInstance>(`/flows/${flowId}/nodes/${nodeId}`, {
      method: 'PATCH',
      body: JSON.stringify(request),
    });
  },

  /**
   * Update node position (optimized endpoint)
   * PATCH /api/flows/:flowId/nodes/:nodeId/position
   */
  async updateNodePosition(flowId: string, nodeId: string, position: UpdateNodePositionRequest): Promise<NodeInstance> {
    return fetchApi<NodeInstance>(`/flows/${flowId}/nodes/${nodeId}/position`, {
      method: 'PATCH',
      body: JSON.stringify(position),
    });
  },

  /**
   * Delete a node (cascades to remove connections)
   * DELETE /api/flows/:flowId/nodes/:nodeId
   */
  async deleteNode(flowId: string, nodeId: string): Promise<void> {
    await fetchApi<void>(`/flows/${flowId}/nodes/${nodeId}`, {
      method: 'DELETE',
    });
  },

  // ============================================
  // Connection Management APIs
  // ============================================

  /**
   * Get all connections in a flow
   * GET /api/flows/:flowId/connections
   */
  async getConnections(flowId: string): Promise<Connection[]> {
    return fetchApi<Connection[]>(`/flows/${flowId}/connections`);
  },

  /**
   * Create a new connection between nodes
   * POST /api/flows/:flowId/connections
   */
  async createConnection(flowId: string, request: CreateConnectionRequest): Promise<Connection> {
    return fetchApi<Connection>(`/flows/${flowId}/connections`, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  /**
   * Delete a connection
   * DELETE /api/flows/:flowId/connections/:connectionId
   */
  async deleteConnection(flowId: string, connectionId: string): Promise<void> {
    await fetchApi<void>(`/flows/${flowId}/connections/${connectionId}`, {
      method: 'DELETE',
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
  // Execution Tracking APIs
  // ============================================

  /**
   * List executions for a flow with pagination
   * GET /api/flows/:flowId/executions
   */
  async getExecutions(
    flowId: string,
    options?: { page?: number; limit?: number; status?: ExecutionStatus; isPreview?: boolean }
  ): Promise<ExecutionListResponse> {
    const params = new URLSearchParams();
    if (options?.page) params.set('page', String(options.page));
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.status) params.set('status', options.status);
    if (options?.isPreview !== undefined) params.set('isPreview', String(options.isPreview));

    const queryString = params.toString();
    const endpoint = `/flows/${flowId}/executions${queryString ? `?${queryString}` : ''}`;
    return fetchApi<ExecutionListResponse>(endpoint);
  },

  /**
   * Get execution details by ID
   * GET /api/flows/:flowId/executions/:executionId
   */
  async getExecution(flowId: string, executionId: string): Promise<FlowExecution> {
    return fetchApi<FlowExecution>(`/flows/${flowId}/executions/${executionId}`);
  },

  // ============================================
  // Chat Preview APIs
  // ============================================

  /**
   * Validate an OpenAI API key
   * POST /api/chat/validate-key
   */
  async validateApiKey(apiKey: string): Promise<ValidateKeyResponse> {
    return fetchApi<ValidateKeyResponse>('/chat/validate-key', {
      method: 'POST',
      body: JSON.stringify({ apiKey }),
    });
  },

  /**
   * Get available LLM models
   * GET /api/chat/models
   */
  async getModels(): Promise<ModelListResponse> {
    return fetchApi<ModelListResponse>('/chat/models');
  },

  /**
   * Stream a chat response with tool calling
   * POST /api/chat/stream (SSE)
   * Returns an async generator that yields ChatStreamEvents
   */
  async *streamChat(
    request: PreviewChatRequest,
    apiKey: string,
  ): AsyncGenerator<ChatStreamEvent, void, unknown> {
    const url = `${API_BASE}/chat/stream`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify(request),
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

    if (!response.body) {
      throw new ApiClientError('No response body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data) {
              try {
                const event: ChatStreamEvent = JSON.parse(data);
                yield event;
              } catch {
                // Ignore invalid JSON
              }
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  },

  // ============================================
  // Schema Validation APIs
  // ============================================

  /**
   * Get schema information for a specific node instance
   * GET /api/flows/:flowId/nodes/:nodeId/schema
   */
  async getNodeSchema(flowId: string, nodeId: string): Promise<NodeSchemaInfo> {
    return fetchApi<NodeSchemaInfo>(`/flows/${flowId}/nodes/${nodeId}/schema`);
  },

  /**
   * Get default schema for a node type
   * GET /api/node-types/:nodeType/schema
   */
  async getNodeTypeSchema(nodeType: string): Promise<NodeTypeSchemaResponse> {
    return fetchApi<NodeTypeSchemaResponse>(`/node-types/${nodeType}/schema`);
  },

  /**
   * Validate a connection between two nodes
   * POST /api/flows/:flowId/connections/validate
   */
  async validateConnection(
    flowId: string,
    request: ValidateConnectionRequest
  ): Promise<ValidateConnectionResponse> {
    return fetchApi<ValidateConnectionResponse>(`/flows/${flowId}/connections/validate`, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  /**
   * Resolve dynamic schema for a node
   * POST /api/flows/:flowId/nodes/:nodeId/schema/resolve
   */
  async resolveNodeSchema(
    flowId: string,
    nodeId: string,
    request: ResolveSchemaRequest
  ): Promise<ResolveSchemaResponse> {
    return fetchApi<ResolveSchemaResponse>(`/flows/${flowId}/nodes/${nodeId}/schema/resolve`, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  /**
   * Validate all connections in a flow
   * GET /api/flows/:flowId/connections/validate
   */
  async validateFlowConnections(flowId: string): Promise<FlowValidationResponse> {
    return fetchApi<FlowValidationResponse>(`/flows/${flowId}/connections/validate`);
  },

  /**
   * Get schema information for all nodes in a flow
   * GET /api/flows/:flowId/schemas
   */
  async getFlowSchemas(flowId: string): Promise<FlowSchemasResponse> {
    return fetchApi<FlowSchemasResponse>(`/flows/${flowId}/schemas`);
  },

  // ============================================
  // Transformer APIs
  // ============================================

  /**
   * Insert a transformer node between two connected nodes
   * POST /api/flows/:flowId/transformers/insert
   */
  async insertTransformer(
    flowId: string,
    request: InsertTransformerRequest
  ): Promise<InsertTransformerResponse> {
    return fetchApi<InsertTransformerResponse>(`/flows/${flowId}/transformers/insert`, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  /**
   * Test a JavaScript transform with sample input
   * POST /api/flows/:flowId/transformers/test
   */
  async testTransform(
    flowId: string,
    request: TestTransformRequest
  ): Promise<TestTransformResponse> {
    return fetchApi<TestTransformResponse>(`/flows/${flowId}/transformers/test`, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

};
