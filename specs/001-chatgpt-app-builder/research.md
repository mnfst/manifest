# Research: ChatGPT App Builder

**Branch**: `001-chatgpt-app-builder` | **Date**: 2025-12-22

## Technology Decisions

### 1. MCP Server Integration (MCP-Nest)

**Decision**: Use [@rekog/mcp-nest](https://github.com/rekog-labs/MCP-Nest) for MCP server functionality

**Rationale**:
- Native NestJS integration with decorators (`@Tool()`, `@Resource()`, `@Prompt()`)
- Automatic tool discovery - decorated methods are exposed automatically
- Uses Zod for parameter validation (aligns with shared package schemas)
- Supports multiple transports: HTTP+SSE, Streamable HTTP, STDIO
- Progress tracking via `context.reportProgress()` for long-running operations
- Full NestJS dependency injection support

**Implementation Pattern**:
```typescript
// Install: npm install @rekog/mcp-nest @modelcontextprotocol/sdk zod@^3

@Module({
  imports: [
    McpModule.forRoot({
      name: 'chatgpt-app-builder',
      version: '1.0.0',
    }),
  ],
})
export class AppModule {}

@Injectable()
export class AppTool {
  @Tool({
    name: 'run-app',
    description: 'Execute a published ChatGPT app',
    parameters: z.object({
      appId: z.string(),
      input: z.string(),
    }),
  })
  async runApp({ appId, input }, context: Context) {
    // Execute workflow logic
  }
}
```

**Alternatives Considered**:
- Raw MCP SDK: More control but requires manual NestJS integration
- Custom implementation: Time-consuming, not needed for POC

**ChatGPT Apps SDK Integration**:

MCP tool responses follow the [ChatGPT Apps SDK](https://developers.openai.com/apps-sdk/quickstart) format to enable UI rendering in ChatGPT:

```typescript
@Tool({
  name: app.toolName,
  description: app.toolDescription,
  parameters: z.object({ message: z.string() }),
})
async executeTool({ message }, context: Context) {
  const app = await this.appService.findBySlug(mcpSlug);

  return {
    content: [{ type: 'text', text: 'Here are the results:' }],
    structuredContent: app.mockData,  // Layout-specific data
    _meta: {
      'openai/outputTemplate': `ui://widget/${app.mcpSlug}.html`
    }
  };
}
```

The `_meta.openai/outputTemplate` points to a UI component that ChatGPT renders in an iframe. Each published app serves its UI at `/servers/{mcpSlug}/ui/{layoutTemplate}.html`.

---

### 2. Chat Interface (assistant-ui)

**Decision**: Use [assistant-ui](https://github.com/assistant-ui/assistant-ui) for the chat panel

**Rationale**:
- Composable primitives inspired by shadcn/ui (consistent with our UI approach)
- Handles streaming, auto-scrolling, accessibility out of the box
- Works with multiple backends including custom implementations
- 400k+ monthly downloads, production-proven
- TypeScript-first with full type safety
- Works with React + Vite (not Next.js specific)

**Implementation Pattern**:
```bash
# Add to existing React project
npx assistant-ui init
```

**Integration with Backend**:
- Will connect to our NestJS backend API for chat testing
- Supports custom message handlers for component rendering
- Real-time streaming for LLM responses

**Alternatives Considered**:
- Custom chat UI: Would require reimplementing streaming, accessibility
- ai/rsc (Vercel AI SDK RSC): Requires Next.js, we're using Vite

---

### 3. Visual Component Editor (Manifest Agentic UI)

**Decision**: Use [Manifest Agentic UI Toolkit](https://ui.manifest.build/) for the visual component editor

**Rationale**:
- Purpose-built for ChatGPT custom apps and MCP applications
- shadcn registry - consistent with shadcn/ui patterns
- Pre-built blocks for conversational interfaces (product cards, forms, confirmations)
- Open source, accessible, and customizable
- Dark/light theme support out of the box
- Designed for agentic UI patterns

**Implementation Pattern**:
```bash
# Install from shadcn registry
npx shadcn@latest add "https://ui.manifest.build/r/product-card"
npx shadcn@latest add "https://ui.manifest.build/r/order-summary"
```

**Available Component Types**:
| Component | Purpose | Use Case |
|-----------|---------|----------|
| Product Card | Display products with images, pricing, badges | E-commerce apps |
| Order Summary | Itemized lists with totals | Checkout, confirmations |
| Form Blocks | Input collection | User data gathering |
| Message Bubbles | Chat display | Conversation UI |
| Action Buttons | User interactions | CTAs, confirmations |

**Editor Approach**:
- Component palette showing available Manifest UI components
- Drag-and-drop or click-to-add components
- Property panel for configuring component props
- Live preview in chat panel

**Alternatives Considered**:
- React Flow: Designed for workflows/node graphs, not component editing
- Custom builder: Significant development effort
- Generic shadcn/ui only: Lacks agentic-specific components

---

### 4. LangChain.js Agent Architecture

**Decision**: Use LangChain.js with modular tool design and configurable LLM providers

**Rationale**:
- Production-ready TypeScript SDK
- Modular architecture: Chains, Agents, Tools as separate concerns
- LCEL (LangChain Expression Language) for declarative pipelines
- Works with multiple LLM providers (OpenAI, Anthropic, etc.)
- Zod integration for tool parameter validation

**Agent Generation Flow** (clarified 2025-12-22):

The agent performs a multi-step generation process when a user submits a prompt:

1. **Layout Selection**: Analyze prompt and select from available templates (POC: table or post-list)
2. **Tool Generation**: Generate LLM-friendly name and description for MCP tool/server
3. **Theme Generation**: Generate shadcn CSS variable overrides based on prompt
4. **Visual Display**: Render selected Manifest UI block in editor

**Implementation Pattern**:
```typescript
// llm/index.ts - Factory pattern for variable LLM
export function createLLM(provider: 'openai' | 'anthropic', config: LLMConfig) {
  switch (provider) {
    case 'openai':
      return new ChatOpenAI(config);
    case 'anthropic':
      return new ChatAnthropic(config);
  }
}

// tools/layout-selector.ts - Select layout template
export const layoutSelectorTool = new DynamicStructuredTool({
  name: 'select_layout',
  description: 'Select the most appropriate layout template for the app',
  schema: z.object({
    prompt: z.string(),
  }),
  func: async ({ prompt }) => {
    // Analyze prompt and return 'table' or 'post-list'
    // POC: hardcoded options, future: dynamic registry
  },
});

// tools/tool-generator.ts - Generate MCP tool metadata
export const toolGeneratorTool = new DynamicStructuredTool({
  name: 'generate_tool_config',
  description: 'Generate MCP tool name and description',
  schema: z.object({
    prompt: z.string(),
    layoutTemplate: z.enum(['table', 'post-list']),
  }),
  func: async ({ prompt, layoutTemplate }) => {
    // Return { name: 'action_noun', description: 'LLM-friendly description' }
  },
});

// tools/theme-generator.ts - Generate shadcn theme variables
export const themeGeneratorTool = new DynamicStructuredTool({
  name: 'generate_theme',
  description: 'Generate shadcn CSS variable overrides',
  schema: z.object({
    prompt: z.string(),
  }),
  func: async ({ prompt }) => {
    // Return ThemeVariables object with CSS variable overrides
  },
});
```

**Tool Organization** (inside backend package, well-separated module):
```
packages/backend/src/agent/
├── index.ts                 # Agent module exports
├── agent.service.ts         # Main agent service (NestJS injectable)
├── agent.module.ts          # NestJS module definition
└── tools/
    ├── index.ts             # Tools registry/exports
    ├── layout-selector.ts   # Select layout template (table/post-list)
    ├── tool-generator.ts    # Generate MCP tool name/description
    ├── theme-generator.ts   # Generate shadcn theme variables
    ├── mock-data-generator.ts # Generate layout-specific mock data
    └── config-validator.ts  # Validate configurations
```

**Separation of Concerns**:
- Agent module is self-contained within `backend/src/agent/`
- Exposes a clean interface via `AgentService` that other backend modules consume
- No direct database access from agent tools - uses injected services
- Can be extracted to separate package in the future if needed

**Alternatives Considered**:
- Raw LLM SDK calls: Less structured, harder to maintain
- LangGraph: More complex than needed for POC
- Custom agent framework: Time-consuming

---

### 5. Database Strategy (SQLite → PostgreSQL)

**Decision**: SQLite with TypeORM, designed for PostgreSQL migration

**Rationale**:
- SQLite for POC: Zero configuration, file-based, fast development
- TypeORM abstracts database differences
- Same entity definitions work with both databases
- Migration path: Change datasource config, run migrations

**Migration-Ready Pattern**:
```typescript
// Use TypeORM decorators that work with both
@Entity()
export class App {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')  // Works in both SQLite and PostgreSQL
  name: string;

  @Column('simple-json')  // SQLite-compatible JSON
  workflow: WorkflowDefinition;

  @CreateDateColumn()
  createdAt: Date;
}
```

**PostgreSQL Migration Steps** (future):
1. Install `pg` driver
2. Update datasource configuration
3. Run TypeORM migrations
4. Update connection string

---

### 6. Monorepo Configuration (Turborepo)

**Decision**: Turborepo with npm workspaces

**Rationale**:
- Fast incremental builds with caching
- Parallel task execution across packages
- Simple npm workspaces (no yarn/pnpm complexity)
- Good TypeScript project references support

**Configuration**:
```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {},
    "type-check": {
      "dependsOn": ["^build"]
    }
  }
}
```

**Package Dependencies** (simplified 3-package structure):
```
shared ──────────────────────────┐
                                 │
                                 ▼
                            backend (includes agent module)
                                 │
                                 ▼
                            frontend
```

Note: Agent is a module inside backend (`backend/src/agent/`), not a separate package.
This simplifies the build process and dependency management for POC.

---

## Integration Patterns

### Frontend ↔ Backend Communication

- REST API for CRUD operations (apps)
- WebSocket/SSE for real-time chat testing
- Shared types via `@chatgpt-app-builder/shared` package

### Backend Agent Module

- Agent is a NestJS module inside the backend package
- Other backend modules inject `AgentService` for LLM operations
- Well-separated via module boundaries (no direct imports of internal agent code)
- Future: Could extract to separate package if needed

### MCP Server Exposure

- Each published app becomes an MCP tool
- Tool name derived from app name/ID
- Tool parameters based on app's expected inputs
- Returns formatted response based on rendering config

---

## Sources

- [MCP-Nest GitHub](https://github.com/rekog-labs/MCP-Nest)
- [assistant-ui GitHub](https://github.com/assistant-ui/assistant-ui)
- [Manifest Agentic UI Toolkit](https://ui.manifest.build/)
- [Manifest.build Platform](https://manifest.build/)
- [LangChain.js Documentation](https://js.langchain.com/docs/concepts/tools/)
- [LangChain TypeScript Best Practices](https://medium.com/@kartikeykumar_60102/langchain-x-typescript-build-real-world-ai-workflows-like-a-pro-03acc17d5b47)
- [LangChain.js GitHub](https://github.com/langchain-ai/langchainjs)
- [shadcn/ui Registry Directory](https://ui.shadcn.com/docs/directory)
