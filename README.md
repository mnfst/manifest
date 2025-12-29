# ChatGPT App Builder

Build ChatGPT-powered applications from natural language prompts. This tool provides a hybrid visual editor + chat interface where users can customize workflows and publish them to serve on an MCP (Model Context Protocol) server.

## Features

- **Prompt-to-App Generation**: Describe your app in natural language and the AI agent generates an initial configuration with appropriate layout, theme, and mock data
- **Hybrid Editor**: Visual preview combined with a chat panel for conversational customization
- **AI-Powered Customization**: Modify layouts, themes, and data through natural language chat commands
- **MCP Server Publishing**: Deploy your apps as MCP tools accessible by AI assistants
- **Manifest UI Components**: Built with [Manifest Agentic UI](https://ui.manifest.build) components (Table, BlogPostList)
- **Dark Mode Support**: Full dark/light theme support across all components

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, Vite, TypeScript, Tailwind CSS, React Router 7 |
| **Backend** | NestJS 10, TypeORM, LangChain |
| **Database** | SQLite (via better-sqlite3) |
| **AI** | LangChain with OpenAI |
| **UI Components** | Manifest UI (shadcn-based) |
| **Monorepo** | Turborepo with pnpm workspaces |

## Project Structure

```
generator/
├── packages/
│   ├── frontend/          # React + Vite application
│   │   └── src/
│   │       ├── components/    # UI components
│   │       ├── lib/           # Utilities & mappers
│   │       └── pages/         # Route pages
│   ├── backend/           # NestJS API server
│   │   └── src/
│   │       ├── agent/         # AI agent (LangChain)
│   │       ├── mcp/           # MCP server & templates
│   │       └── entities/      # TypeORM entities
│   └── shared/            # Shared types & constants
├── specs/                 # Feature specifications
└── turbo.json             # Turborepo configuration
```

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- pnpm >= 9.0.0 (install via `npm install -g pnpm` or use corepack: `corepack enable`)
- OpenAI API key

### Installation

```bash
# Clone the repository
git clone https://github.com/mnfst/generator.git
cd generator

# Install dependencies
pnpm install

# Configure environment
cp packages/backend/.env.example packages/backend/.env
# Edit .env and add your OPENAI_API_KEY
```

### Development

```bash
# Start all services (frontend, backend, shared)
pnpm dev
```

This starts:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001/api
- **MCP Servers**: http://localhost:3001/servers/{slug}/mcp

### Build

```bash
# Build all packages
pnpm build

# Type check
pnpm type-check

# Lint
pnpm lint
```

## How It Works

1. **Create**: Enter a natural language prompt describing your app (e.g., "Show a list of blog posts about technology")

2. **Customize**: Use the chat panel to refine your app:
   - "Change the primary color to blue"
   - "Switch to a table layout"
   - "Add more sample data"

3. **Publish**: Deploy your app to the MCP server with one click

4. **Connect**: Use the generated MCP endpoint in any AI assistant that supports the Model Context Protocol

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/apps` | List all apps |
| `POST` | `/api/apps` | Create new app |
| `GET` | `/api/apps/:id` | Get app details |
| `PATCH` | `/api/apps/:id` | Update app |
| `POST` | `/api/apps/:id/publish` | Publish to MCP |
| `POST` | `/api/views/:id/chat` | Chat with AI agent |
| `GET` | `/servers/:slug/mcp` | MCP server endpoint |

## Layout Templates

| Template | Component | Use Case |
|----------|-----------|----------|
| **Table** | Manifest Table | Tabular data, lists, order history |
| **Post List** | Manifest BlogPostList | Content feeds, articles, blog posts |

## License

UNLICENSED - Proprietary software by MNFST, Inc.
