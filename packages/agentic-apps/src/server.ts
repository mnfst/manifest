import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import express from 'express'
import { registerPdfViewerExtension } from './extensions/pdf-viewer.extension.js'
import { registerVideoPlayerExtension } from './extensions/video-player.extension.js'
import { registerImageViewerExtension } from './extensions/image-viewer.extension.js'
import { registerAudioPlayerExtension } from './extensions/audio-player.extension.js'

function createServer() {
  const server = new McpServer({
    name: 'Manifest Agentic Apps',
    version: '0.0.1'
  })

  // Register extensions
  registerPdfViewerExtension(server)
  registerVideoPlayerExtension(server)
  registerImageViewerExtension(server)
  registerAudioPlayerExtension(server)

  return server
}

const app = express()
app.use(express.json())

// Store active sessions
const sessions = new Map<string, StreamableHTTPServerTransport>()

app.post('/mcp', async (req, res, next) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined

  // Existing session
  if (sessionId && sessions.has(sessionId)) {
    const transport = sessions.get(sessionId)!
    await transport.handleRequest(req, res, req.body).catch(next)
    return
  }

  // New session - create transport and server
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
    enableJsonResponse: true
  })

  const server = createServer()

  transport.onclose = () => {
    const sid = (transport as unknown as { sessionId?: string }).sessionId
    if (sid) sessions.delete(sid)
  }

  await server.connect(transport as Transport)
  await transport.handleRequest(req, res, req.body).catch(next)

  // Store session after successful initialization
  const newSessionId = (transport as unknown as { sessionId?: string }).sessionId
  if (newSessionId) {
    sessions.set(newSessionId, transport)
  }
})

// Handle GET for SSE streams
app.get('/mcp', async (req, res, next) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined

  if (!sessionId || !sessions.has(sessionId)) {
    res.status(400).json({ error: 'Invalid or missing session ID' })
    return
  }

  const transport = sessions.get(sessionId)!
  await transport.handleRequest(req, res).catch(next)
})

// Handle DELETE for session cleanup
app.delete('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined

  if (sessionId && sessions.has(sessionId)) {
    const transport = sessions.get(sessionId)!
    await transport.close()
    sessions.delete(sessionId)
  }

  res.status(204).end()
})

app.listen(3000, () => {
  console.log('MCP server listening on http://localhost:3000/mcp')
})
