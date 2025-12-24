import type {
  App,
  GenerateAppRequest,
  ChatRequest,
  ChatResponse,
  PublishResult,
  ApiError,
} from '@chatgpt-app-builder/shared';

/**
 * API base URL - uses Vite proxy in development
 */
const API_BASE = '/api';

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
  /**
   * Generate a new app from a prompt
   * POST /api/generate
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
   */
  async getCurrentApp(): Promise<App> {
    return fetchApi<App>('/current');
  },

  /**
   * Send a chat message to customize the app
   * POST /api/chat
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
   */
  async publishApp(): Promise<PublishResult> {
    return fetchApi<PublishResult>('/publish', {
      method: 'POST',
    });
  },
};
