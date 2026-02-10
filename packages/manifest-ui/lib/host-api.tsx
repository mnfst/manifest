'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react'

import type { App, McpUiHostContext } from '@modelcontextprotocol/ext-apps'
import { useApp, useDocumentTheme } from '@modelcontextprotocol/ext-apps/react'

import type { DisplayMode, Theme } from './mcp-types'
export type { DisplayMode, Theme }

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
  setWidgetState: (state: Record<string, unknown>) => void
}

export interface HostAPI extends HostContext, HostActions {}

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
  // Track host context changes from MCP Apps SDK
  const [hostContext, setHostContext] = useState<McpUiHostContext | undefined>(undefined)
  const [toolInput, setToolInput] = useState<Record<string, unknown>>({})
  const [toolOutput, setToolOutput] = useState<unknown>(null)

  // Widget state (local, since MCP Apps doesn't have built-in widget state)
  const [widgetState, setWidgetStateInternal] = useState<Record<string, unknown> | null>(null)

  // Connect to MCP Apps host via useApp hook
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { app, isConnected, error: _error } = useApp({
    appInfo: { name: 'ManifestUI', version: '1.0.0' },
    capabilities: {},
    onAppCreated: (newApp: App) => {
      newApp.onhostcontextchanged = (params) => {
        setHostContext((prev) => ({ ...prev, ...params }))
      }
      newApp.ontoolinput = (params) => {
        setToolInput((params.arguments as Record<string, unknown>) ?? {})
      }
      newApp.ontoolresult = (params) => {
        setToolOutput(params)
      }
    }
  })

  // Use reactive theme from document (set by host styles)
  const documentTheme = useDocumentTheme()

  const isRealHost = isConnected && !!app

  // Store callback in ref to avoid re-running effect
  const onDisplayModeRequestRef = useRef(onDisplayModeRequest)
  onDisplayModeRequestRef.current = onDisplayModeRequest

  // Build context from MCP Apps or use defaults/overrides
  const context: HostContext = useMemo(() => {
    if (isRealHost) {
      const initialCtx = app.getHostContext()
      const mergedCtx = { ...initialCtx, ...hostContext }
      return {
        theme: (mergedCtx?.theme as Theme) ?? documentTheme ?? 'light',
        displayMode: (mergedCtx?.displayMode as DisplayMode) ?? 'inline',
        locale: 'en-US',
        isRealHost: true,
        toolInput,
        toolOutput,
        widgetState
      }
    }

    return {
      ...defaultHostContext,
      theme: overrideTheme ?? 'light',
      displayMode: overrideDisplayMode ?? 'inline'
    }
  }, [isRealHost, app, hostContext, documentTheme, toolInput, toolOutput, widgetState, overrideTheme, overrideDisplayMode])

  // Request display mode change
  const requestDisplayMode = useCallback(
    (mode: DisplayMode) => {
      if (isRealHost && app) {
        app.requestDisplayMode({ mode })
      } else {
        onDisplayModeRequestRef.current?.(mode)
      }
    },
    [isRealHost, app]
  )

  // Send a follow-up message to the conversation
  const sendFollowUpMessage = useCallback(
    (prompt: string) => {
      if (isRealHost && app) {
        app.sendMessage({
          role: 'user',
          content: [{ type: 'text', text: prompt }]
        })
      } else {
        console.log('[Preview] sendFollowUpMessage:', prompt)
      }
    },
    [isRealHost, app]
  )

  // Open an external link
  const openExternal = useCallback(
    (url: string) => {
      if (isRealHost && app) {
        app.openLink({ url })
      } else {
        window.open(url, '_blank', 'noopener,noreferrer')
      }
    },
    [isRealHost, app]
  )

  // Call an MCP tool
  const callTool = useCallback(
    async (toolName: string, args: Record<string, unknown>): Promise<unknown> => {
      if (isRealHost && app) {
        return app.callServerTool({ name: toolName, arguments: args })
      } else {
        console.log('[Preview] callTool:', toolName, args)
        return { success: true, preview: true }
      }
    },
    [isRealHost, app]
  )

  // Persist widget state (local only — MCP Apps has updateModelContext instead)
  const setWidgetState = useCallback(
    (state: Record<string, unknown>) => {
      setWidgetStateInternal(state)
      if (isRealHost && app) {
        app.updateModelContext({
          structuredContent: state
        })
      } else {
        console.log('[Preview] setWidgetState:', state)
      }
    },
    [isRealHost, app]
  )

  const api: HostAPI = useMemo(
    () => ({
      ...context,
      requestDisplayMode,
      sendFollowUpMessage,
      openExternal,
      callTool,
      setWidgetState
    }),
    [
      context,
      requestDisplayMode,
      sendFollowUpMessage,
      openExternal,
      callTool,
      setWidgetState
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
 * In MCP host: Uses the real MCP Apps bridge
 * In Preview: Uses mock implementations with console logging
 */
export function useHostAPI(): HostAPI {
  const context = useContext(HostAPIContext)

  if (!context) {
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
      setWidgetState: () => {}
    }
  }

  return context
}

/**
 * Hook to check if running in a real MCP host vs preview mode.
 */
export function useIsRealHost(): boolean {
  const { isRealHost } = useHostAPI()
  return isRealHost
}

/**
 * Hook to get the initial tool output (structuredContent from MCP response).
 */
export function useToolOutput<T = unknown>(): T | null {
  const { toolOutput } = useHostAPI()
  return (toolOutput as T) ?? null
}

/**
 * Hook to get the tool input (arguments passed when the tool was invoked).
 */
export function useToolInput<T extends Record<string, unknown> = Record<string, unknown>>(): T {
  const { toolInput } = useHostAPI()
  return (toolInput as T) ?? ({} as T)
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
