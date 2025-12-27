# Quickstart: MCP App and Flow Data Architecture

**Feature Branch**: `002-mcp-server-flow`
**Date**: 2025-12-26

## Overview

This feature restructures the application from a single-entity model (App with layout/mockData) to a hierarchical model (App → Flow → View). This enables:

- **Apps** to serve as MCP servers at unique URLs
- **Flows** to represent individual MCP tools within an app
- **Views** to define ordered display screens within a flow

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm >= 10.2.0
- OPENAI_API_KEY in backend `.env` (optional, mock fallback available)

### Setup

```bash
# From repository root
npm install

# Start development servers
npm run dev

# Backend runs at http://localhost:3001
# Frontend runs at http://localhost:5173
```

### Database

SQLite database auto-creates at `packages/backend/data/app.db` with schema auto-sync enabled.

## User Workflow

### 1. Create an App

Navigate to `http://localhost:5173/` and fill out the app creation form:

- **Name** (required): Display name for your MCP server
- **Description** (optional): Purpose of this app
- **Theme** (optional): Customize colors (HSL-based CSS variables)

On submit, you're redirected to the App Dashboard.

### 2. Create a Flow

From the App Dashboard, enter a natural language prompt describing your tool:

```
"A tool that displays customer orders in a sortable table"
```

The AI generates:
- Flow metadata (name, description, toolName, toolDescription)
- Initial View with appropriate layoutTemplate and mockData

You're automatically redirected to the Flow Editor.

### 3. Edit Flow & Views

**Flow Editor** (`/app/:appId/flow/:flowId`):
- View and edit flow properties (name, description)
- See list of views in order
- Add/remove/reorder views
- Click a view to edit it

**View Editor** (`/app/:appId/flow/:flowId/view/:viewId`):
- Chat panel on the left for AI-assisted modifications
- Component preview on the right
- Modify layoutTemplate, mockData, styling via chat

### 4. Manage Flows

Return to App Dashboard to:
- See all flows for the app
- Create additional flows
- Delete flows
- Navigate to flow editors

## API Quick Reference

### App Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/apps` | Create new app |
| GET | `/api/apps/current` | Get current session app |
| GET | `/api/apps/:id` | Get app with flows |
| PATCH | `/api/apps/:id` | Update app |
| POST | `/api/apps/:id/publish` | Publish to MCP |

### Flow Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/apps/:appId/flows` | List flows |
| POST | `/api/apps/:appId/flows` | Create flow (AI) |
| GET | `/api/flows/:id` | Get flow with views |
| PATCH | `/api/flows/:id` | Update flow |
| DELETE | `/api/flows/:id` | Delete flow |

### View Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/flows/:flowId/views` | List views (ordered) |
| POST | `/api/flows/:flowId/views` | Add view |
| POST | `/api/flows/:flowId/views/reorder` | Reorder views |
| GET | `/api/views/:id` | Get view |
| PATCH | `/api/views/:id` | Update view |
| DELETE | `/api/views/:id` | Delete view |
| POST | `/api/views/:id/chat` | Chat to modify view |

## Frontend Routes

| Route | Page | Description |
|-------|------|-------------|
| `/` | Home | App creation form |
| `/app/:appId` | AppDashboard | Flow list, create flow prompt |
| `/app/:appId/flow/:flowId` | FlowEditor | View list, flow properties |
| `/app/:appId/flow/:flowId/view/:viewId` | ViewEditor | Chat + preview |

## Key Files

### Backend

```
packages/backend/src/
├── app/                    # App module (CRUD, session)
├── flow/                   # Flow module (CRUD, AI generation)
├── view/                   # View module (CRUD, reorder)
├── agent/                  # LangChain flow generation
├── entities/               # TypeORM entities
└── mcp/                    # MCP server integration
```

### Frontend

```
packages/frontend/src/
├── pages/
│   ├── Home.tsx            # App creation
│   ├── AppDashboard.tsx    # Flow management
│   ├── FlowEditor.tsx      # View management
│   └── ViewEditor.tsx      # AI-assisted editing
├── components/
│   ├── app/                # App form components
│   ├── flow/               # Flow list/card components
│   ├── view/               # View list/card components
│   ├── editor/             # Preview components
│   └── chat/               # Chat panel
└── lib/api.ts              # API client
```

### Shared

```
packages/shared/src/types/
├── app.ts                  # App types
├── flow.ts                 # Flow types
├── view.ts                 # View types
├── theme.ts                # ThemeVariables
└── mock-data.ts            # MockData types
```

## Development Tips

### Type Safety

All API requests/responses are typed via shared package:

```typescript
import { App, Flow, View, CreateFlowRequest } from '@chatgpt-app-builder/shared';
```

### Entity Relationships

```typescript
// Fetch app with all flows and views
const app = await appRepo.findOne({
  where: { id: appId },
  relations: ['flows', 'flows.views']
});
```

### View Ordering

Views are ordered by the `order` column. Use the reorder endpoint to update positions:

```typescript
await api.post(`/flows/${flowId}/views/reorder`, {
  viewIds: ['view-3', 'view-1', 'view-2'] // New order
});
```

## Limitations (POC Scope)

- **Single-app session**: Each page load starts fresh; no cross-session persistence
- **No authentication**: Anyone can access any app by URL
- **No real-time sync**: Changes require page refresh to see
- **Desktop only**: Mobile views not optimized

These limitations are documented in the constitution and will be addressed post-POC.
