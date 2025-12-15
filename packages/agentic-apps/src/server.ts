import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import express from 'express'
import { registerPdfViewerExtension } from './extensions/pdf-viewer.extension.js'
import { registerVideoPlayerExtension } from './extensions/video-player.extension.js'
import { registerImageViewerExtension } from './extensions/image-viewer.extension.js'
import { registerAudioPlayerExtension } from './extensions/audio-player.extension.js'

const server = new McpServer({
  name: 'Manifest Agentic Apps',
  version: '0.0.1'
})

// Register extensions
registerPdfViewerExtension(server)
registerVideoPlayerExtension(server)
registerImageViewerExtension(server)
registerAudioPlayerExtension(server)

const app = express()
app.use(express.json())

app.use('/mcp', async (req, res, next) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
    enableJsonResponse: true
  })

  res.on('close', () => {
    transport.close()
  })

  await server.connect(transport as Transport)

  await transport.handleRequest(req, res, req.body).catch(next)
})
app.listen(3000, () => {
  console.log('MCP server listening on http://localhost:3000/mcp')
})
