# Manifest

A visual workflow builder for creating AI-powered applications. Design flows through a drag-and-drop interface and deploy them as MCP (Model Context Protocol) servers accessible to AI assistants.

## Features

- **Visual Flow Editor** — Drag-and-drop node-based interface powered by React Flow
- **Workflow Execution** — Execute flows with automatic context passing between nodes
- **MCP Server Publishing** — Deploy workflows as MCP tools for AI assistant integration
- **AI-Powered Customization** — Refine workflows through natural language chat
- **Dark/Light Themes** — Full theme support with customizable variables

## Quick Start

### Prerequisites

- Node.js >= 18.0.0
- pnpm >= 9.0.0 (`corepack enable` or `npm install -g pnpm`)

### Installation

```bash
git clone https://github.com/mnfst/manifest.git
cd manifest
pnpm install
```

### First-Time Setup

```bash
# Build shared packages (required before first run)
pnpm --filter @manifest/shared build
pnpm --filter @manifest/nodes build

# Create database directory
mkdir -p packages/backend/data
```

### Development

```bash
pnpm dev
```

This starts:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001/api
- **MCP Servers**: http://localhost:3001/servers/{slug}/mcp

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Vite 6, TypeScript 5.7, React Flow, TailwindCSS |
| Backend | NestJS 10, TypeORM, LangChain |
| Database | SQLite (better-sqlite3) |
| Monorepo | Turborepo + pnpm workspaces |

## Project Structure

```
manifest/
├── packages/
│   ├── frontend/          # React + Vite application
│   ├── backend/           # NestJS API server
│   ├── nodes/             # Node type definitions
│   └── shared/            # Shared types & schemas
├── Dockerfile             # Multi-stage production build
├── docker-compose.yml     # Container orchestration
└── turbo.json             # Turborepo configuration
```

## Node Types

| Category | Node | Description |
|----------|------|-------------|
| Trigger | UserIntent | Entry point for MCP tools, defines user input schema |
| Action | ApiCall | Make HTTP requests to external APIs |
| Interface | StatCard | Display metric cards with values |
| Interface | PostList | Render lists of posts/content items |
| Transform | JavaScriptCode | Transform data with custom JavaScript |
| Return | Return | Return flow output to caller |
| Return | CallFlow | Execute nested flows |
| Return | Link | Navigate to external URLs |

## Scripts

```bash
pnpm dev          # Start development servers
pnpm build        # Build all packages
pnpm test         # Run tests
pnpm lint         # ESLint checks
pnpm type-check   # TypeScript validation
pnpm clean        # Clean build artifacts
```

## Docker Deployment

### Using Docker Compose

```bash
docker compose up --build     # Build and run
docker compose up -d          # Run in background
docker compose logs -f app    # View logs
docker compose down           # Stop
```

### Standalone Docker

```bash
docker build -t manifest .
docker run -p 3001:3001 -e OPENAI_API_KEY=sk-... manifest
```

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/apps` | List all apps |
| POST | `/api/apps` | Create new app |
| GET | `/api/apps/:id` | Get app details |
| PATCH | `/api/apps/:id` | Update app |
| POST | `/api/apps/:id/publish` | Publish to MCP |
| GET | `/api/flows` | List flows |
| POST | `/api/flows/:flowId/execute` | Execute a flow |
| GET | `/api/node-types` | Available node type schemas |
| POST | `/api/chat` | AI chat endpoint |
| GET | `/servers/:slug/mcp` | MCP server endpoint |

## How It Works

1. **Design** — Create flows visually by connecting nodes in the editor
2. **Configure** — Set node parameters, API endpoints, and data transformations
3. **Execute** — Test flows directly or via the execution engine
4. **Publish** — Deploy as an MCP server with one click
5. **Connect** — Use the MCP endpoint in any AI assistant supporting Model Context Protocol

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | No | OpenAI API key for AI customization features |
| `PORT` | No | Server port (default: 3001) |
| `NODE_ENV` | No | Environment mode (development/production) |

### Email Configuration

Manifest includes email support for transactional emails using React Email templates.

| Variable | Required | Description |
|----------|----------|-------------|
| `EMAIL_PROVIDER` | No | `console` (default) or `mailgun` |
| `EMAIL_FROM` | No | Sender email (default: `noreply@example.com`) |
| `EMAIL_FROM_NAME` | No | Sender name (default: `Manifest`) |
| `MAILGUN_API_KEY` | If using Mailgun | Your Mailgun API key |
| `MAILGUN_DOMAIN` | If using Mailgun | Your Mailgun domain |

**Development** — Emails logged to console:
```env
EMAIL_PROVIDER=console
```

**Production** — Using Mailgun:
```env
EMAIL_PROVIDER=mailgun
EMAIL_FROM=noreply@yourdomain.com
MAILGUN_API_KEY=key-xxx
MAILGUN_DOMAIN=mg.yourdomain.com
```

## Contributing

Contributions are welcome. Please open an issue first to discuss what you would like to change.

## License

[MIT](./LICENSE)
