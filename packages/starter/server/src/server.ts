import { McpServer } from 'skybridge/server'

const server = new McpServer(
  {
    name: 'manifest-starter',
    version: '0.0.1'
  },
  { capabilities: {} }
).registerWidget(
  'canvas', // Must match the filename: canvas.tsx
  {},
  {
    description:
      'Canvas widget. Use this the display the canvas with elements.',
    inputSchema: {
      message: { type: 'string' }
    }
  },
  async ({ message }) => {
    // Your widget logic here
    return {
      content: [
        {
          type: 'text',
          text: message || 'Hello World'
        }
      ]
    }
  }
)

export default server
export type AppType = typeof server
