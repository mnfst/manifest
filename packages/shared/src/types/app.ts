import type { ThemeVariables } from './theme.js';

/**
 * App status enum
 */
export type AppStatus = 'draft' | 'published';

/**
 * Layout template types (POC: 2 options)
 */
export type LayoutTemplate = 'table' | 'post-list';

/**
 * Defines an action that can be triggered by a UI component
 */
export interface LayoutAction {
  name: string;
  label: string;
  description: string;
}

/**
 * Layout template configuration with Manifest UI block information and actions
 */
export interface LayoutTemplateConfig {
  manifestBlock: string;
  installCommand: string;
  useCase: string;
  actions: LayoutAction[];
}

/**
 * Layout registry with Manifest UI block information
 */
export const LAYOUT_REGISTRY: Record<LayoutTemplate, LayoutTemplateConfig> = {
  table: {
    manifestBlock: '@manifest/table',
    installCommand: 'npx shadcn@latest add @manifest/table',
    useCase: 'Tabular data, lists, order history',
    actions: [],
  },
  'post-list': {
    manifestBlock: '@manifest/blog-post-list',
    installCommand: 'npx shadcn@latest add @manifest/blog-post-list',
    useCase: 'Content feeds, articles, blog posts',
    actions: [
      {
        name: 'onReadMore',
        label: 'Read More',
        description: 'Triggered when user clicks Read More button',
      },
    ],
  },
};

/**
 * Main App entity representing an MCP server
 * Contains flows (MCP tools) which contain views
 */
export interface App {
  id: string;
  name: string;
  description?: string;
  slug: string;
  themeVariables: ThemeVariables;
  status: AppStatus;
  logoUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Request to create a new app
 */
export interface CreateAppRequest {
  name: string;
  description?: string;
  themeVariables?: Partial<ThemeVariables>;
}

/**
 * Request to update an app
 */
export interface UpdateAppRequest {
  name?: string;
  description?: string;
  themeVariables?: Partial<ThemeVariables>;
  status?: AppStatus;
  logoUrl?: string | null;
}

/**
 * App with flows included
 */
export interface AppWithFlows extends App {
  flows?: import('./flow.js').Flow[];
}

/**
 * App with flow count for list views
 */
export interface AppWithFlowCount extends App {
  flowCount: number;
}

/**
 * Response from app deletion
 */
export interface DeleteAppResponse {
  success: boolean;
  deletedFlowCount: number;
}

/**
 * Response from icon upload
 */
export interface IconUploadResponse {
  iconUrl: string;
}

/**
 * Legacy types for backwards compatibility during transition
 * @deprecated Use CreateAppRequest instead
 */
export interface GenerateAppRequest {
  prompt: string;
}

/**
 * @deprecated Use ViewChatRequest from view.ts instead
 */
export interface ChatRequest {
  message: string;
}

/**
 * @deprecated Use ViewChatResponse from view.ts instead
 */
export interface ChatResponse {
  response: string;
  app: App;
  changes: string[];
}
