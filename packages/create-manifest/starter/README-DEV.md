# Manifest MCP Server - Developer Guide

This is an MCP (Model Context Protocol) server template for building AI-powered flows.

## Project Structure

```
src/
├── server.ts                 # Express + MCP server setup
├── flows/                    # MCP flows (tools, resources)
│   └── gameboy.flow.ts       # Example flow
└── web/                      # Web components (UI widgets)
    └── gameboy-player/       # Example web component
        ├── gameboy-player.html
        ├── gameboy-player.ts
        └── gameboy-player.css
scripts/
└── build-web.ts              # Vite build script for web components
```

## Getting Started

```bash
# Install dependencies
npm install

# Start development server (with hot reload)
npm run dev

# Build for production
npm run build

# Run production build
npm start
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |

## Creating Flows

Flows register tools and resources with the MCP server. See `src/flows/gameboy.flow.ts` for a complete example.

### Basic Flow Structure

```typescript
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"

export function registerMyFlow(server: McpServer): void {
  // Register a tool
  server.registerTool(
    "myTool",
    {
      title: "My Tool",
      description: "Does something useful",
      inputSchema: z.object({
        input: z.string().describe("The input parameter")
      })
    },
    async (args) => {
      return {
        content: [{ type: "text", text: `Result: ${args.input}` }]
      }
    }
  )

  // Register a resource (UI widget)
  server.registerResource("my-widget", "ui://my-widget.html", {}, async () => ({
    contents: [
      {
        uri: "ui://my-widget.html",
        mimeType: "text/html+skybridge",
        text: "<html>...</html>"
      }
    ]
  }))
}
```

### Registering Your Flow

Add your flow to `src/server.ts`:

```typescript
import { registerMyFlow } from "./flows/my.flow.js"

function createServer() {
  const server = new McpServer({
    name: "My MCP Server",
    version: "0.0.1"
  })

  registerMyFlow(server)

  return server
}
```

## Creating Web Components

Web components are built with Vite and bundled into single HTML files.

1. Create a folder in `src/web/` with your component files
2. Add the component to `scripts/build-web.ts`
3. Reference the built HTML in your flow

### Build Configuration

Edit `scripts/build-web.ts` to add new web components:

```typescript
const components = [
  'gameboy-player',
  'my-new-component'  // Add your component here
]
```

## MCP Endpoints

The server exposes the following endpoints:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/mcp` | Create session / Send messages |
| `GET` | `/mcp` | SSE stream for server events |
| `DELETE` | `/mcp` | Close session |

Sessions are managed via the `mcp-session-id` header.

## Development Tips

- The server uses Nodemon for hot reload during development
- Web components are rebuilt on file changes
- Use `console.log()` for debugging - output appears in the terminal

## Testing with ChatGPT

1. Deploy your server to a public URL (or use ngrok for local testing)
2. Add the MCP server URL in ChatGPT settings
3. Your tools will be available in the chat

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Build TypeScript and web components |
| `npm run build:web` | Build only web components |
| `npm start` | Run production build |

## Dependencies

- `@modelcontextprotocol/sdk` - MCP protocol implementation
- `express` - HTTP server
- `zod` - Schema validation
- `dotenv` - Environment variables
- `vite` - Web component bundling

## License

MIT
