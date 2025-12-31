// =============================================================================
// OpenAI Apps SDK TypeScript types
// https://developers.openai.com/apps-sdk/reference/
// =============================================================================

export type DisplayMode = "inline" | "fullscreen" | "pip";
export type Theme = "light" | "dark";

// Tool response metadata passed via _meta field
export interface ToolResponseMetadata {
  [key: string]: unknown;
}

// The window.openai object injected by ChatGPT
export interface OpenAIBridge {
  // Read-only context properties
  theme: Theme;
  displayMode: DisplayMode;
  maxHeight?: number;
  safeArea?: { top: number; bottom: number; left: number; right: number };
  view?: string;
  userAgent?: string;
  locale?: string;

  // Tool data
  toolInput: Record<string, unknown>;
  toolOutput: unknown;
  toolResponseMetadata: ToolResponseMetadata;

  // Widget state persistence
  widgetState: Record<string, unknown> | null;
  setWidgetState: (state: Record<string, unknown>) => void;

  // Runtime APIs
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  sendFollowUpMessage: (options: { prompt: string }) => void;
  requestDisplayMode: (options: { mode: DisplayMode }) => void;
  openExternal: (options: { href: string }) => void;
  requestClose: () => void;
  notifyIntrinsicHeight: (height: number) => void;
  requestModal: (options: unknown) => void;

  // File APIs
  uploadFile: (file: File) => Promise<{ fileId: string }>;
  getFileDownloadUrl: (options: { fileId: string }) => Promise<string>;
}

// Extend Window interface
declare global {
  interface Window {
    openai?: OpenAIBridge;
  }
}

// Re-export for convenience
export type { OpenAIBridge as WindowOpenAI };
