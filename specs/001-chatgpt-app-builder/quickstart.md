# Quickstart Guide: ChatGPT App Builder

**Branch**: `001-chatgpt-app-builder` | **Date**: 2025-12-22

## Prerequisites

- Node.js 18+ installed
- npm 9+ installed
- OpenAI API key (or other LLM provider key)

## Project Setup

### 1. Clone and Install

```bash
# From repository root
npm install
```

This installs all workspace dependencies via Turborepo.

### 2. Environment Configuration

Create `.env` files in each package that needs them:

```bash
# packages/backend/.env
DATABASE_URL=sqlite:./data/app.db
PORT=3001

# LLM Configuration (passed to agent)
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-your-key-here

# packages/frontend/.env
VITE_API_URL=http://localhost:3001/api
```

### 3. Initialize Database

```bash
# From packages/backend
npm run db:init
```

This creates the SQLite database and runs initial migrations.

### 4. Start Development Servers

```bash
# From repository root - starts all packages in dev mode
npm run dev
```

Or start individually:

```bash
# Terminal 1: Backend (port 3001)
cd packages/backend && npm run dev

# Terminal 2: Frontend (port 5173)
cd packages/frontend && npm run dev
```

## Usage Walkthrough

### Step 1: Create an App from Prompt

1. Open http://localhost:5173
2. Enter a prompt describing your desired app:
   ```
   A customer support chatbot that helps users track their orders
   and process returns
   ```
3. Click "Generate App"
4. Wait for the agent to generate your initial configuration (~10-20 seconds)

The agent performs a multi-step process:
- **Layout Selection**: Chooses table or post-list based on your prompt
- **Tool Generation**: Creates an LLM-friendly name and description for the MCP tool
- **Theme Generation**: Defines shadcn CSS variables to style your app

### Step 2: Customize via Chat

1. You're now in the hybrid editor view
2. **Visual Display (left panel)**:
   - Shows the current app configuration
   - Displays the selected Manifest UI block with applied theme
   - Updates in real-time as you make changes via chat

3. **Chat Panel (right panel)**:
   - Send messages to customize your app
   - The agent interprets your requests and updates the configuration

**Example customization requests:**
```
"Change the primary color to a dark blue"
"Switch to a table layout"
"Update the tool name to 'track_shipment'"
"Make the background lighter"
```

4. **Test your app**:
   - Send test messages to see how your app responds
   - The chat panel shows responses with your configured components

### Step 3: Publish to MCP Server

1. Click "Publish" in the top-right
2. Review the tool configuration:
   - **Tool Name**: The LLM-friendly name (e.g., `track_order`)
   - **Tool Description**: Describes when LLMs should use this tool
3. Confirm publication
4. Note the MCP endpoint URL:
   ```
   /servers/my-support-bot/mcp
   ```

### Step 4: Connect an MCP Client

Use the published endpoint with any MCP-compatible client:

```typescript
import { Client } from '@modelcontextprotocol/sdk/client';

const client = new Client({
  name: 'my-assistant',
  version: '1.0.0',
});

// Connect to your app's MCP server
await client.connect({
  transport: {
    type: 'http',
    url: 'http://localhost:3001/servers/my-support-bot/mcp',
  },
});

// List available tools
const tools = await client.listTools();
// Returns: [{ name: 'track_order', description: '...' }]

// Use the tool
const result = await client.callTool({
  name: 'track_order',  // Your custom tool name
  arguments: { message: 'Where is my order #12345?' },
});

console.log(result);
```

## Available npm Scripts

### Root (Turborepo)

| Script | Description |
|--------|-------------|
| `npm run dev` | Start all packages in development mode |
| `npm run build` | Build all packages |
| `npm run lint` | Lint all packages |
| `npm run type-check` | Type-check all packages |

### Backend (`packages/backend`)

| Script | Description |
|--------|-------------|
| `npm run dev` | Start NestJS in watch mode (port 3001) |
| `npm run build` | Build for production |
| `npm run db:init` | Initialize SQLite database |
| `npm run db:migrate` | Run pending migrations |

### Frontend (`packages/frontend`)

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Vite dev server (port 5173) |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |

## Project Structure Overview

```
packages/
├── frontend/          # React + Vite app - user interface
│   └── src/
│       ├── pages/     # Home, Editor pages
│       └── components/
│           ├── ui/        # Manifest UI components
│           ├── editor/    # Visual display
│           └── chat/      # Chat panel
├── backend/           # NestJS app - API, MCP servers & Agent
│   └── src/
│       ├── app/
│       │   ├── apps/      # App CRUD module
│       │   ├── mcp/       # MCP server hosting module
│       │   └── generation/ # Uses agent for app generation
│       └── agent/         # LangChain agent module (well-separated)
│           ├── agent.module.ts
│           ├── agent.service.ts
│           └── tools/     # Agent tools (separate files)
└── shared/            # Shared TypeScript types
    └── src/types/     # App, Component, MCP types
```

Note: The agent is a module inside the backend package for simplicity.
It's well-separated from other business logic via NestJS module boundaries.

## Customizing via Chat

All app customizations in the POC are made through the chat panel. The agent understands various types of requests:

### Theme Changes
```
"Change the primary color to blue"
"Make the background darker"
"Use a warmer color palette"
```

### Layout Changes
```
"Switch to a table layout"
"Change to a post list view"
```

### Tool Configuration
```
"Rename the tool to 'find_products'"
"Update the tool description to mention customer support"
```

### Testing
```
"Show me an example order"
"Test with a product search query"
```

## Customizing MCP Tool Names

Tool names and descriptions are crucial for LLMs to understand when to use your tool:

```typescript
// Good: Clear, action-oriented
name: "get_order_status"
description: "Retrieve the current status and tracking info for a customer order.
Use when customer asks about order status, shipping, or delivery.
Requires order ID or customer email."

// Bad: Vague, unhelpful
name: "order"
description: "Order stuff"
```

## Troubleshooting

### "Cannot connect to backend"
- Ensure backend is running on port 3001
- Check `VITE_API_URL` in frontend `.env`

### "LLM errors"
- Verify your API key in `packages/backend/.env`
- Check LLM_PROVIDER matches your key type

### "Database errors"
- Delete `packages/backend/data/app.db` and run `npm run db:init`

### "MCP connection failed"
- Ensure the app is published (status: published)
- Verify the endpoint URL matches the app's mcpSlug
- Check that the app has valid toolName and toolDescription

## Next Steps

- Customize tool names and descriptions for better LLM understanding
- Try different prompts to generate different app configurations
- Experiment with theme customization via chat
- Build apps for different use cases (e-commerce, support, etc.)
- Try different LLM providers by changing `LLM_PROVIDER`
