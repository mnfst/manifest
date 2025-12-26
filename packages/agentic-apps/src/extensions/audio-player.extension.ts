import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { readFileSync } from 'node:fs'

const extensionParams = {
  name: 'Audio Player',
  id: 'audio-player',
  description:
    'Plays an audio file. Requires an absolute URL (starting with https://).'
}

/**
 * Renders the audio player HTML by reading the built single-file HTML.
 */
export function renderHtml(): string {
  return readFileSync('./dist/web/audio-player/audio-player.html', 'utf-8')
}

/**
 * Validates that the audio URL is accessible.
 */
async function validateAudioUrl(
  audioUrl: string
): Promise<{ valid: true } | { valid: false; error: string }> {
  try {
    const response = await fetch(audioUrl, { method: 'HEAD' })
    if (!response.ok) {
      return {
        valid: false,
        error: `Audio not found (HTTP ${response.status}). The URL may be outdated or incorrect: ${audioUrl}`
      }
    }
    const contentType = response.headers.get('content-type')
    if (contentType && !contentType.includes('audio') && !contentType.includes('octet-stream')) {
      return {
        valid: false,
        error: `URL does not point to an audio file (content-type: ${contentType})`
      }
    }
    return { valid: true }
  } catch (err) {
    return {
      valid: false,
      error: `Could not access audio URL: ${err instanceof Error ? err.message : 'Unknown error'}`
    }
  }
}

/**
 * Registers the Audio Player extension with the MCP server.
 */
export function registerAudioPlayerExtension(server: McpServer): void {
  server.registerResource(
    extensionParams.id,
    `ui://${extensionParams.id}.html`,
    {},
    async () => ({
      contents: [
        {
          uri: `ui://${extensionParams.id}.html`,
          mimeType: 'text/html+skybridge',
          text: renderHtml(),
          _meta: { 'openai/widgetPrefersBorder': true }
        }
      ]
    })
  )

  server.registerTool(
    'play-audio',
    {
      title: extensionParams.name,
      description: extensionParams.description,
      inputSchema: z.object({
        audioUrl: z
          .string()
          .url()
          .describe('Absolute URL of the audio file (must start with https://)')
      }),
      _meta: {
        'openai/outputTemplate': `ui://${extensionParams.id}.html`
      }
    },
    async (args: { audioUrl: string }) => {
      const audioUrl = args.audioUrl
      const validation = await validateAudioUrl(audioUrl)
      if (!validation.valid) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${validation.error}` }],
          isError: true
        }
      }

      return {
        content: [{ type: 'text' as const, text: `Playing audio: ${audioUrl}` }],
        structuredContent: { audioUrl }
      }
    }
  )
}
