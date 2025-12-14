import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import express from 'express'

const server = new McpServer({
  name: 'Manifest Agentic Apps',
  version: '0.0.1'
})

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
