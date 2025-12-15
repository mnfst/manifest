import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { readFileSync } from 'node:fs'

const extensionParams = {
  name: 'Image Viewer',
  id: 'image-viewer',
  description:
    'Displays an image with zoom capability. Requires an absolute URL (starting with https://).'
}

/**
 * Renders the image viewer HTML by reading the built single-file HTML.
 */
export function renderHtml(): string {
  return readFileSync('./dist/web/image-viewer/image-viewer.html', 'utf-8')
}

/**
 * Validates that the image URL is accessible.
 */
async function validateImageUrl(
  imageUrl: string
): Promise<{ valid: true } | { valid: false; error: string }> {
  try {
    const response = await fetch(imageUrl, { method: 'HEAD' })
    if (!response.ok) {
      return {
        valid: false,
        error: `Image not found (HTTP ${response.status}). The URL may be outdated or incorrect: ${imageUrl}`
      }
    }
    const contentType = response.headers.get('content-type')
    if (contentType && !contentType.includes('image')) {
      return {
        valid: false,
        error: `URL does not point to an image file (content-type: ${contentType})`
      }
    }
    return { valid: true }
  } catch (err) {
    return {
      valid: false,
      error: `Could not access image URL: ${err instanceof Error ? err.message : 'Unknown error'}`
    }
  }
}

/**
 * Registers the Image Viewer extension with the MCP server.
 */
export function registerImageViewerExtension(server: McpServer): void {
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
    'view-image',
    {
      title: extensionParams.name,
      description: extensionParams.description,
      inputSchema: z.object({
        imageUrl: z
          .string()
          .url()
          .describe('Absolute URL of the image (must start with https://)')
      }),
      _meta: {
        'openai/outputTemplate': `ui://${extensionParams.id}.html`
      }
    },
    async (args) => {
      const imageUrl = (args as { imageUrl: string }).imageUrl
      const validation = await validateImageUrl(imageUrl)
      if (!validation.valid) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${validation.error}` }],
          isError: true
        }
      }

      return {
        content: [{ type: 'text' as const, text: `Displaying image: ${imageUrl}` }],
        structuredContent: { imageUrl }
      }
    }
  )
}
