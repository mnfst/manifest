import type { ThemeVariables } from './theme';
import type { MockData } from './mock-data';

/**
 * App status enum
 */
export type AppStatus = 'draft' | 'published';

/**
 * Layout template types (POC: 2 options)
 */
export type LayoutTemplate = 'table' | 'post-list';

/**
 * Layout registry with Manifest UI block information
 */
export const LAYOUT_REGISTRY: Record<
  LayoutTemplate,
  {
    manifestBlock: string;
    installCommand: string;
    useCase: string;
  }
> = {
  table: {
    manifestBlock: '@manifest/table',
    installCommand: 'npx shadcn@latest add @manifest/table',
    useCase: 'Tabular data, lists, order history',
  },
  'post-list': {
    manifestBlock: '@manifest/blog-post-list',
    installCommand: 'npx shadcn@latest add @manifest/blog-post-list',
    useCase: 'Content feeds, articles, blog posts',
  },
};

/**
 * Main App entity representing a user-created ChatGPT application
 */
export interface App {
  id: string;
  name: string;
  description?: string;
  layoutTemplate: LayoutTemplate;
  systemPrompt: string;
  themeVariables: ThemeVariables;
  mockData: MockData;
  toolName?: string;
  toolDescription?: string;
  mcpSlug?: string;
  status: AppStatus;
}

/**
 * Request to generate a new app from a prompt
 */
export interface GenerateAppRequest {
  prompt: string;
}

/**
 * Request to send a chat message for customization
 */
export interface ChatRequest {
  message: string;
}

/**
 * Response from chat endpoint
 */
export interface ChatResponse {
  response: string;
  app: App;
  changes: string[];
}
