import type { ThemeVariables } from './theme.js';

/**
 * App status enum
 */
export type AppStatus = 'draft' | 'published';

/**
 * Layout template types
 */
export type LayoutTemplate = 'stat-card' | 'post-list' | 'blank-component';

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
  /** Default component code (TSX) for this template */
  defaultCode?: string;
  /** Sample data for preview rendering */
  sampleData?: unknown;
}

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
