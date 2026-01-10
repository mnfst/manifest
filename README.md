# Flows & Nodes - Visual Workflow Editor

A visual node-based workflow editor and execution platform. Build application workflows through a drag-and-drop interface and deploy them as MCP (Model Context Protocol) servers accessible to AI assistants.

## Features

- **Visual Flow Editor**: Drag-and-drop node-based interface powered by @xyflow/react
- **Workflow Execution Engine**: Execute flows with context passing between nodes
- **MCP Server Publishing**: Deploy workflows as MCP tools for AI assistant integration
- **AI-Powered Customization**: Refine workflows through natural language chat (LangChain + OpenAI)
- **Dark Mode Support**: Full dark/light theme support

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, Vite 6, TypeScript 5.7, @xyflow/react, TailwindCSS, CodeMirror 6 |
| **Backend** | NestJS 10, TypeORM, LangChain |
| **Database** | SQLite (via better-sqlite3) |
| **AI** | LangChain with OpenAI |
| **Monorepo** | Turborepo with pnpm workspaces |

## Project Structure

```
generator/
├── packages/
│   ├── frontend/          # React + Vite application
│   │   └── src/
│   │       ├── components/    # UI & editor components
│   │       ├── pages/         # Route pages
│   │       ├── hooks/         # React hooks
│   │       └── lib/           # Utilities
│   ├── backend/           # NestJS API server
│   │   └── src/
│   │       ├── flow/          # Flow CRUD & persistence
│   │       ├── flow-execution/# Execution engine
│   │       ├── node/          # Node type schemas
│   │       ├── mcp/           # MCP server implementation
│   │       └── agent/         # LangChain AI agent
│   ├── nodes/             # Node type definitions
│   │   └── src/nodes/
│   │       ├── trigger/       # UserIntent trigger node
│   │       ├── action/        # ApiCall node
│   │       ├── interface/     # StatCard, PostList UI nodes
│   │       ├── transform/     # JavaScriptCode transform node
│   │       └── return/        # Return, CallFlow, Link nodes
│   └── shared/            # Shared types & schemas
├── specs/                 # Feature specifications
├── Dockerfile             # Multi-stage production build
├── docker-compose.yml     # Container orchestration
└── turbo.json             # Turborepo configuration
```

## Node Types

| Category | Node | Description |
|----------|------|-------------|
| **Trigger** | UserIntent | Entry point for MCP tools, defines user input schema |
| **Action** | ApiCall | Make HTTP requests to external APIs |
| **Interface** | StatCard | Display metric cards with values |
| **Interface** | PostList | Render lists of posts/content items |
| **Transform** | JavaScriptCode | Transform data with custom JavaScript |
| **Return** | Return | Return flow output to caller |
| **Return** | CallFlow | Execute nested flows |
| **Return** | Link | Navigate to external URLs |

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- pnpm >= 9.0.0 (`corepack enable` or `npm install -g pnpm`)
- OpenAI API key (optional, for AI customization)

### Installation

```bash
# Clone the repository
git clone https://github.com/mnfst/generator.git
cd generator

# Install dependencies
pnpm install

# Configure environment
cp packages/backend/.env.example packages/backend/.env
# Edit .env and set OPENAI_API_KEY if you want to use AI features
```

### Development

```bash
# Start all services
pnpm dev
```

This starts:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001/api
- **MCP Servers**: http://localhost:3001/servers/{slug}/mcp

### Build & Quality

```bash
pnpm build        # Build all packages
pnpm type-check   # TypeScript validation
pnpm lint         # ESLint checks
pnpm clean        # Clean build artifacts
```

## Docker Deployment

### Using Docker Compose

```bash
# Build and run
docker compose up --build

# Run in background
docker compose up -d

# View logs
docker compose logs -f app

# Stop
docker compose down
```

### Standalone Docker

```bash
docker build -t chatgpt-app-builder .
docker run -p 3001:3001 \
  -e OPENAI_API_KEY=sk-... \
  chatgpt-app-builder
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/apps` | List all apps |
| `POST` | `/api/apps` | Create new app |
| `GET` | `/api/apps/:id` | Get app details |
| `PATCH` | `/api/apps/:id` | Update app |
| `POST` | `/api/apps/:id/publish` | Publish to MCP |
| `GET` | `/api/flows` | List flows |
| `POST` | `/api/flows/:flowId/execute` | Execute a flow |
| `GET` | `/api/node-types` | Available node type schemas |
| `POST` | `/api/chat` | AI chat endpoint |
| `GET` | `/servers/:slug/mcp` | MCP server endpoint |

## How It Works

1. **Design**: Create flows visually by connecting nodes in the editor
2. **Configure**: Set node parameters, API endpoints, and data transformations
3. **Execute**: Test flows directly or via the execution engine
4. **Publish**: Deploy as an MCP server with one click
5. **Connect**: Use the MCP endpoint in any AI assistant supporting Model Context Protocol

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | No | OpenAI API key for AI customization features |
| `PORT` | No | Server port (default: 3001) |
| `NODE_ENV` | No | Environment mode (development/production) |

## Email Configuration

The platform includes an email module for sending transactional emails (password reset, invitations) using React Email templates.

### Email Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `EMAIL_PROVIDER` | No | `console` (default, logs to terminal) or `mailgun` |
| `EMAIL_FROM` | No | Sender email address (default: `noreply@example.com`) |
| `EMAIL_FROM_NAME` | No | Sender display name (default: `Manifest`) |
| `APP_URL` | No | Your app's URL for email links |
| `MAILGUN_API_KEY` | If using Mailgun | Your Mailgun API key |
| `MAILGUN_DOMAIN` | If using Mailgun | Your Mailgun domain (e.g., `mg.yourdomain.com`) |
| `MAILGUN_EU_REGION` | No | Set to `true` if using Mailgun EU region |

### Quick Setup

**Development** (emails logged to console):
```env
EMAIL_PROVIDER=console
```

**Production** (Mailgun):
```env
EMAIL_PROVIDER=mailgun
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME=Manifest
MAILGUN_API_KEY=key-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
MAILGUN_DOMAIN=mg.yourdomain.com
```

### Available Email Templates

| Template | Description |
|----------|-------------|
| `password-reset` | Password reset request with secure link |
| `invitation` | App/workspace invitation |

### Usage in Code

```typescript
// Send password reset email
await emailService.sendPasswordReset('user@example.com', {
  userName: 'John Doe',
  resetLink: 'https://yourapp.com/reset?token=abc123',
  expiresIn: '1 hour',
});

// Send invitation email
await emailService.sendInvitation('invitee@example.com', {
  inviterName: 'Jane Smith',
  appName: 'My App',
  appLink: 'https://yourapp.com/invite?code=xyz789',
});
```

## License

UNLICENSED - Proprietary software by MNFST, Inc.
