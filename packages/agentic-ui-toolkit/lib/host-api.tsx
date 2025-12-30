'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode
} from 'react'

// Import shared OpenAI types
import type { DisplayMode, OpenAIBridge, Theme } from './openai-types'
import './openai-types' // Side effect: extends Window interface

export type { DisplayMode, OpenAIBridge, Theme }

// =============================================================================
// Host API Context (abstraction layer for components)
// =============================================================================

export interface HostContext {
  theme: Theme
  displayMode: DisplayMode
  locale: string
  isRealHost: boolean
  toolInput: Record<string, unknown>
  toolOutput: unknown
  widgetState: Record<string, unknown> | null
}

export interface HostActions {
  requestDisplayMode: (mode: DisplayMode) => void
  sendFollowUpMessage: (prompt: string) => void
  openExternal: (url: string) => void
  callTool: (toolName: string, args: Record<string, unknown>) => Promise<unknown>
  notifyIntrinsicHeight: (height: number) => void
  setWidgetState: (state: Record<string, unknown>) => void
  requestClose: () => void
  uploadFile: (file: File) => Promise<{ fileId: string }>
  getFileDownloadUrl: (fileId: string) => Promise<string>
}

export interface HostAPI extends HostContext, HostActions {}

// =============================================================================
// Utility: Subscribe to window.openai global changes
// =============================================================================

function subscribeToOpenAIGlobals(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {}

  const handler = () => callback()
  window.addEventListener('openai:set_globals', handler)
  return () => window.removeEventListener('openai:set_globals', handler)
}

function getOpenAISnapshot(): OpenAIBridge | undefined {
  if (typeof window === 'undefined') return undefined
  return window.openai
}

function getOpenAIServerSnapshot(): OpenAIBridge | undefined {
  return undefined
}

// =============================================================================
// Default values for preview mode
// =============================================================================

const defaultHostContext: HostContext = {
  theme: 'light',
  displayMode: 'inline',
  locale: 'en-US',
  isRealHost: false,
  toolInput: {},
  toolOutput: null,
  widgetState: null
}

// =============================================================================
// Context
// =============================================================================

const HostAPIContext = createContext<HostAPI | null>(null)

// =============================================================================
// Provider Props
// =============================================================================

interface HostAPIProviderProps {
  children: ReactNode
  // Preview mode overrides
  onDisplayModeRequest?: (mode: DisplayMode) => void
  displayMode?: DisplayMode
  theme?: Theme
}

// =============================================================================
// Provider Component
// =============================================================================

export function HostAPIProvider({
  children,
  onDisplayModeRequest,
  displayMode: overrideDisplayMode,
  theme: overrideTheme
}: HostAPIProviderProps) {
  // Subscribe to window.openai changes using useSyncExternalStore
  const openai = useSyncExternalStore(
    subscribeToOpenAIGlobals,
    getOpenAISnapshot,
    getOpenAIServerSnapshot
  )

  const isRealHost = !!openai

  // Store callback in ref to avoid re-running effect
  const onDisplayModeRequestRef = useRef(onDisplayModeRequest)
  onDisplayModeRequestRef.current = onDisplayModeRequest

  // In preview mode, inject a mock window.openai so registry components work
  // Only run once on mount (empty deps) to avoid infinite loops
  useEffect(() => {
    if (typeof window === 'undefined') return
    // Don't override if real ChatGPT window.openai exists
    if (window.openai && !('_isPreviewMock' in window.openai)) return

    // Create mock window.openai for preview
    const mockOpenAI: OpenAIBridge & { _isPreviewMock: boolean } = {
      _isPreviewMock: true,
      theme: overrideTheme ?? 'light',
      displayMode: overrideDisplayMode ?? 'inline',
      locale: 'en-US',
      toolInput: {},
      toolOutput: null,
      toolResponseMetadata: {},
      widgetState: null,
      setWidgetState: (state) => console.log('[Preview] setWidgetState:', state),
      callTool: async (name, args) => {
        console.log('[Preview] callTool:', name, args)
        return { success: true, preview: true }
      },
      sendFollowUpMessage: ({ prompt }) => console.log('[Preview] sendFollowUpMessage:', prompt),
      requestDisplayMode: ({ mode }) => {
        console.log('[Preview] requestDisplayMode:', mode)
        onDisplayModeRequestRef.current?.(mode)
      },
      openExternal: ({ href }) => window.open(href, '_blank', 'noopener,noreferrer'),
      requestClose: () => console.log('[Preview] requestClose'),
      notifyIntrinsicHeight: () => {},
      requestModal: () => {},
      uploadFile: async (file) => {
        console.log('[Preview] uploadFile:', file.name)
        return { fileId: `preview-${Date.now()}` }
      },
      getFileDownloadUrl: async ({ fileId }) => `https://example.com/preview/${fileId}`
    }

    window.openai = mockOpenAI

    return () => {
      // Cleanup on unmount
      if (window.openai && '_isPreviewMock' in window.openai) {
        delete window.openai
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Build context from window.openai or use defaults/overrides
  const hostContext: HostContext = useMemo(() => {
    if (isRealHost && openai) {
      return {
        theme: openai.theme ?? 'light',
        displayMode: openai.displayMode ?? 'inline',
        locale: openai.locale ?? 'en-US',
        isRealHost: true,
        toolInput: openai.toolInput ?? {},
        toolOutput: openai.toolOutput ?? null,
        widgetState: openai.widgetState ?? null
      }
    }

    return {
      ...defaultHostContext,
      theme: overrideTheme ?? 'light',
      displayMode: overrideDisplayMode ?? 'inline'
    }
  }, [isRealHost, openai, overrideTheme, overrideDisplayMode])

  // Request display mode change
  const requestDisplayMode = useCallback(
    (mode: DisplayMode) => {
      if (isRealHost && openai) {
        openai.requestDisplayMode({ mode })
      } else {
        onDisplayModeRequest?.(mode)
      }
    },
    [isRealHost, openai, onDisplayModeRequest]
  )

  // Send a follow-up message to the conversation
  const sendFollowUpMessage = useCallback(
    (prompt: string) => {
      if (isRealHost && openai) {
        openai.sendFollowUpMessage({ prompt })
      } else {
        console.log('[Preview] sendFollowUpMessage:', prompt)
      }
    },
    [isRealHost, openai]
  )

  // Open an external link
  const openExternal = useCallback(
    (url: string) => {
      if (isRealHost && openai) {
        openai.openExternal({ href: url })
      } else {
        window.open(url, '_blank', 'noopener,noreferrer')
      }
    },
    [isRealHost, openai]
  )

  // Call an MCP tool
  const callTool = useCallback(
    async (toolName: string, args: Record<string, unknown>): Promise<unknown> => {
      if (isRealHost && openai) {
        return openai.callTool(toolName, args)
      } else {
        console.log('[Preview] callTool:', toolName, args)
        return { success: true, preview: true }
      }
    },
    [isRealHost, openai]
  )

  // Notify host of intrinsic height change
  const notifyIntrinsicHeight = useCallback(
    (height: number) => {
      if (isRealHost && openai) {
        openai.notifyIntrinsicHeight(height)
      }
    },
    [isRealHost, openai]
  )

  // Persist widget state
  const setWidgetState = useCallback(
    (state: Record<string, unknown>) => {
      if (isRealHost && openai) {
        openai.setWidgetState(state)
      } else {
        console.log('[Preview] setWidgetState:', state)
      }
    },
    [isRealHost, openai]
  )

  // Request to close the widget
  const requestClose = useCallback(() => {
    if (isRealHost && openai) {
      openai.requestClose()
    } else {
      console.log('[Preview] requestClose')
    }
  }, [isRealHost, openai])

  // Upload a file
  const uploadFile = useCallback(
    async (file: File): Promise<{ fileId: string }> => {
      if (isRealHost && openai) {
        return openai.uploadFile(file)
      } else {
        console.log('[Preview] uploadFile:', file.name)
        return { fileId: `preview-${Date.now()}` }
      }
    },
    [isRealHost, openai]
  )

  // Get file download URL
  const getFileDownloadUrl = useCallback(
    async (fileId: string): Promise<string> => {
      if (isRealHost && openai) {
        return openai.getFileDownloadUrl({ fileId })
      } else {
        console.log('[Preview] getFileDownloadUrl:', fileId)
        return `https://example.com/preview/${fileId}`
      }
    },
    [isRealHost, openai]
  )

  const api: HostAPI = useMemo(
    () => ({
      ...hostContext,
      requestDisplayMode,
      sendFollowUpMessage,
      openExternal,
      callTool,
      notifyIntrinsicHeight,
      setWidgetState,
      requestClose,
      uploadFile,
      getFileDownloadUrl
    }),
    [
      hostContext,
      requestDisplayMode,
      sendFollowUpMessage,
      openExternal,
      callTool,
      notifyIntrinsicHeight,
      setWidgetState,
      requestClose,
      uploadFile,
      getFileDownloadUrl
    ]
  )

  return <HostAPIContext.Provider value={api}>{children}</HostAPIContext.Provider>
}

// =============================================================================
// Hooks
// =============================================================================

/**
 * Hook to access the host API from any component.
 *
 * In ChatGPT: Uses the real window.openai bridge
 * In Preview: Uses mock implementations with console logging
 *
 * Usage:
 * ```tsx
 * function MyComponent() {
 *   const {
 *     theme,
 *     displayMode,
 *     toolOutput,
 *     requestDisplayMode,
 *     sendFollowUpMessage,
 *     callTool
 *   } = useHostAPI()
 *
 *   return (
 *     <div className={theme === 'dark' ? 'dark' : ''}>
 *       <p>Mode: {displayMode}</p>
 *       <button onClick={() => requestDisplayMode('fullscreen')}>
 *         Expand
 *       </button>
 *       <button onClick={() => sendFollowUpMessage('User clicked action')}>
 *         Send Message
 *       </button>
 *     </div>
 *   )
 * }
 * ```
 */
export function useHostAPI(): HostAPI {
  const context = useContext(HostAPIContext)

  if (!context) {
    // Return a default implementation if not wrapped in provider
    return {
      ...defaultHostContext,
      requestDisplayMode: (mode) => console.warn('[No HostAPIProvider] requestDisplayMode:', mode),
      sendFollowUpMessage: (prompt) =>
        console.warn('[No HostAPIProvider] sendFollowUpMessage:', prompt),
      openExternal: (url) => window.open(url, '_blank', 'noopener,noreferrer'),
      callTool: async (name, args) => {
        console.warn('[No HostAPIProvider] callTool:', name, args)
        return null
      },
      notifyIntrinsicHeight: () => {},
      setWidgetState: () => {},
      requestClose: () => {},
      uploadFile: async () => ({ fileId: 'mock' }),
      getFileDownloadUrl: async () => ''
    }
  }

  return context
}

/**
 * Hook to check if running in ChatGPT (real host) vs preview mode.
 */
export function useIsRealHost(): boolean {
  const { isRealHost } = useHostAPI()
  return isRealHost
}

/**
 * Hook to directly access the window.openai bridge.
 * Use this when you need low-level access to OpenAI-specific features.
 */
export function useOpenAI(): OpenAIBridge | undefined {
  return useSyncExternalStore(subscribeToOpenAIGlobals, getOpenAISnapshot, getOpenAIServerSnapshot)
}

/**
 * Hook to get the initial tool output (structuredContent from MCP response).
 * This is the data your MCP server returned that triggered this widget.
 */
export function useToolOutput<T = unknown>(): T | null {
  const openai = useOpenAI()
  return (openai?.toolOutput as T) ?? null
}

/**
 * Hook to get the tool input (arguments passed when the tool was invoked).
 */
export function useToolInput<T extends Record<string, unknown> = Record<string, unknown>>(): T {
  const openai = useOpenAI()
  return (openai?.toolInput as T) ?? ({} as T)
}

/**
 * Hook to manage widget state that persists across renders.
 */
export function useWidgetState<T extends Record<string, unknown>>(): [
  T | null,
  (state: T) => void
] {
  const { widgetState, setWidgetState } = useHostAPI()
  return [widgetState as T | null, setWidgetState as (state: T) => void]
}
