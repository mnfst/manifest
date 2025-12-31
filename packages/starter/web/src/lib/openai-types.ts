// =============================================================================
// OpenAI Apps SDK TypeScript types
// Re-exports from skybridge/web which provides the canonical types
// https://developers.openai.com/apps-sdk/reference/
// =============================================================================

// Re-export types from skybridge/web
export type {
  DisplayMode,
  Theme,
  OpenAiMethods,
  OpenAiProperties
} from 'skybridge/web'

// Legacy alias for backwards compatibility
import type { OpenAiMethods, OpenAiProperties } from 'skybridge/web'

export type OpenAIBridge = OpenAiMethods & OpenAiProperties
