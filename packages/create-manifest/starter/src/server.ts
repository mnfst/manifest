import 'dotenv/config'
import type { IncomingMessage } from 'node:http'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import express from 'express'
import { registerGameboyFlow } from './flows/gameboy.flow.js'

// Session storage
interface SessionData {
  transport: StreamableHTTPServerTransport
}
const sessions = new Map<string, SessionData>()

function createServer() {
  const server = new McpServer({
    name: 'Manifest Starter',
    version: '0.0.1'
  })

  registerGameboyFlow(server)

  return server
}

const app = express()
app.use(express.json())

// CORS headers for all responses
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.header(
    'Access-Control-Allow-Headers',
    'Content-Type, Accept, Authorization, mcp-session-id'
  )
  res.header(
    'Access-Control-Expose-Headers',
    'mcp-session-id, WWW-Authenticate'
  )
  next()
})

// Handle CORS preflight
app.options('/mcp', (_req, res) => {
  res.sendStatus(204)
})

app.post('/mcp', async (req, res, next) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined

  // Existing session
  if (sessionId && sessions.has(sessionId)) {
    const session = sessions.get(sessionId)!
    await session.transport
      .handleRequest(req as unknown as IncomingMessage, res, req.body)
      .catch(next)
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
  await transport
    .handleRequest(req as unknown as IncomingMessage, res, req.body)
    .catch(next)

  // Store session after successful initialization
  const newSessionId = (transport as unknown as { sessionId?: string })
    .sessionId
  if (newSessionId) {
    sessions.set(newSessionId, { transport })
  }
})

// Handle GET for SSE streams
app.get('/mcp', async (req, res, next) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined

  if (!sessionId || !sessions.has(sessionId)) {
    res.status(400).json({ error: 'Invalid or missing session ID' })
    return
  }

  const session = sessions.get(sessionId)!
  await session.transport
    .handleRequest(req as unknown as IncomingMessage, res)
    .catch(next)
})

// Handle DELETE for session cleanup
app.delete('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined

  if (sessionId && sessions.has(sessionId)) {
    const session = sessions.get(sessionId)!
    await session.transport.close()
    sessions.delete(sessionId)
  }

  res.status(204).end()
})

const port = Number(process.env.PORT) || 3000

app.listen(port, '0.0.0.0', () => {
  console.log(`GameBoy MCP server listening on http://localhost:${port}/mcp`)
})
