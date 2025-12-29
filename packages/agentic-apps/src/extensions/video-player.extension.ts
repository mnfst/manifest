import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { readFileSync } from 'node:fs'

const extensionParams = {
  name: 'Video Player',
  id: 'video-player',
  description:
    'Opens a video in an interactive player. Requires an absolute URL (starting with https://).'
}

/**
 * Renders the video player HTML by reading the built single-file HTML.
 */
export function renderHtml(): string {
  return readFileSync('./dist/web/video-player/video-player.html', 'utf-8')
}

/**
 * Validates that the video URL is accessible and returns a video.
 */
async function validateVideoUrl(
  videoUrl: string
): Promise<{ valid: true } | { valid: false; error: string }> {
  try {
    const response = await fetch(videoUrl, { method: 'HEAD' })
    if (!response.ok) {
      return {
        valid: false,
        error: `Video not found (HTTP ${response.status}). The URL may be outdated or incorrect: ${videoUrl}`
      }
    }
    const contentType = response.headers.get('content-type')
    if (contentType && !contentType.includes('video') && !contentType.includes('octet-stream')) {
      return {
        valid: false,
        error: `URL does not point to a video file (content-type: ${contentType})`
      }
    }
    return { valid: true }
  } catch (err) {
    return {
      valid: false,
      error: `Could not access video URL: ${err instanceof Error ? err.message : 'Unknown error'}`
    }
  }
}

/**
 * Registers the Video Player extension with the MCP server.
 */
export function registerVideoPlayerExtension(server: McpServer): void {
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
    'view-video',
    {
      title: extensionParams.name,
      description: extensionParams.description,
      inputSchema: z.object({
        videoUrl: z
          .string()
          .url()
          .describe('Absolute URL of the video (must start with https://)')
      }),
      _meta: {
        'openai/outputTemplate': `ui://${extensionParams.id}.html`
      }
    },
    async (args: { videoUrl: string }) => {
      const videoUrl = args.videoUrl
      const validation = await validateVideoUrl(videoUrl)
      if (!validation.valid) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${validation.error}` }],
          isError: true
        }
      }

      return {
        content: [{ type: 'text' as const, text: `Playing video: ${videoUrl}` }],
        structuredContent: { videoUrl }
      }
    }
  )
}
