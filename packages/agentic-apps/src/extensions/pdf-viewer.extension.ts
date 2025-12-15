import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { readFileSync } from 'node:fs'

const extensionParams = {
  name: 'PDF Viewer',
  id: 'pdf-viewer',
  description:
    'Opens a PDF document in an interactive viewer. Requires an absolute URL (starting with https://).'
}

/**
 * Renders the PDF viewer HTML by reading the built single-file HTML.
 */
export function renderHtml(): string {
  return readFileSync('./dist/web/pdf-viewer/pdf-viewer.html', 'utf-8')
}

/**
 * Validates that the PDF URL is accessible and returns a PDF.
 */
async function validatePdfUrl(
  pdfUrl: string
): Promise<{ valid: true } | { valid: false; error: string }> {
  try {
    const response = await fetch(pdfUrl, { method: 'HEAD' })
    if (!response.ok) {
      return {
        valid: false,
        error: `PDF not found (HTTP ${response.status}). The URL may be outdated or incorrect: ${pdfUrl}`
      }
    }
    const contentType = response.headers.get('content-type')
    if (contentType && !contentType.includes('pdf')) {
      return {
        valid: false,
        error: `URL does not point to a PDF file (content-type: ${contentType})`
      }
    }
    return { valid: true }
  } catch (err) {
    return {
      valid: false,
      error: `Could not access PDF URL: ${err instanceof Error ? err.message : 'Unknown error'}`
    }
  }
}

/**
 * Registers the PDF Viewer extension with the MCP server.
 */
export function registerPdfViewerExtension(server: McpServer): void {
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
    `view-pdf`,
    {
      title: extensionParams.name,
      description: extensionParams.description,
      inputSchema: z.object({
        pdfUrl: z
          .string()
          .url()
          .describe('Absolute URL of the PDF document (must start with https://)')
      }),
      _meta: {
        'openai/outputTemplate': `ui://${extensionParams.id}.html`
      }
    },
    async (args) => {
      const pdfUrl = (args as { pdfUrl: string }).pdfUrl
      const validation = await validatePdfUrl(pdfUrl)
      if (!validation.valid) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${validation.error}` }],
          isError: true
        }
      }

      return {
        content: [{ type: 'text' as const, text: `Opening PDF: ${pdfUrl}` }],
        structuredContent: { pdfUrl }
      }
    }
  )
}
