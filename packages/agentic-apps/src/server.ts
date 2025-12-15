import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import express from 'express'
import { readFileSync } from 'node:fs'
import { registerPdfViewerExtension } from './extensions/pdf-viewer.extension.js'

const server = new McpServer({
  name: 'Manifest Agentic Apps',
  version: '0.0.1'
})

const demoHtml = readFileSync('./dist/web/demo/demo.html', 'utf-8')

server.registerResource('demo', 'ui://demo.html', {}, async () => ({
  contents: [
    {
      uri: 'ui://widget/todo.html',
      mimeType: 'text/html+skybridge',
      text: demoHtml,
      _meta: { 'openai/widgetPrefersBorder': true }
    }
  ]
}))

server.registerTool(
  'show-demo',
  {
    title: 'Show Demo UI',
    description: 'Displays the demo user interface.',
    _meta: {
      'openai/outputTemplate': 'ui://demo.html'
    }
  },
  async () => {
    return {
      content: [{ type: 'text' as const, text: 'Demo UI displayed.' }],
      structuredContent: {}
    }
  }
)

// Register extensions
registerPdfViewerExtension(server)

const app = express()
app.use(express.json())

app.use('/mcp', async (req, res, next) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true
  })

  res.on('close', () => {
    transport.close()
  })

  await server.connect(transport)

  await transport.handleRequest(req, res, req.body).catch(next)
})
app.listen(3000, () => {
  console.log('MCP server listening on http://localhost:3000/mcp')
})
