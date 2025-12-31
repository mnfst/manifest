// =============================================================================
// OpenAI Apps SDK TypeScript types
// These types are compatible with skybridge/web which extends Window globally
// https://developers.openai.com/apps-sdk/reference/
// =============================================================================

export type DisplayMode = 'inline' | 'fullscreen' | 'pip'
export type Theme = 'light' | 'dark'

// Properties available on window.openai (read-only context)
export type OpenAiProperties = {
  theme: Theme
  displayMode: DisplayMode
  maxHeight: number
  locale: string
  toolInput: Record<string, unknown>
  toolOutput: Record<string, unknown> | { text: string } | null
  toolResponseMetadata: Record<string, unknown> | null
  widgetState: Record<string, unknown> | null
}

// Note: window.openai is globally typed by skybridge/web
// We only define the property types needed for our components
