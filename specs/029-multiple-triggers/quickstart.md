# Quickstart: Multiple Triggers per Flow

**Feature**: 029-multiple-triggers
**Date**: 2026-01-06

## Overview

This guide explains how to implement the key components for the multiple triggers feature.

---

## 1. Update Shared Types

### packages/shared/src/types/flow.ts

```typescript
// Remove tool fields from Flow interface
export interface Flow {
  id: string;
  appId: string;
  name: string;
  description?: string;
  isActive: boolean;
  // REMOVED: toolName, toolDescription, parameters
  nodes: NodeInstance[];
  connections: Connection[];
  createdAt: string;
  updatedAt: string;
}

// Add helper interface for computed properties
export interface FlowWithMeta extends Flow {
  exposedTools: string[];
  hasTriggers: boolean;
}
```

### packages/shared/src/types/node.ts

```typescript
export interface UserIntentNodeParameters {
  // Existing
  whenToUse?: string;
  whenNotToUse?: string;

  // New fields (from Flow)
  toolName: string;
  toolDescription: string;
  parameters?: FlowParameter[];
  isActive?: boolean;
}
```

---

## 2. Update Backend Entity

### packages/backend/src/flow/flow.entity.ts

```typescript
@Entity('flows')
export class FlowEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  appId!: string;

  @Column({ type: 'varchar', length: 300 })
  name!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description?: string;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  // REMOVE these columns:
  // @Column({ type: 'varchar', length: 100 })
  // toolName!: string;
  // @Column({ type: 'varchar', length: 500 })
  // toolDescription!: string;
  // @Column({ type: 'simple-json', nullable: true })
  // parameters?: FlowParameter[];

  @Column({ type: 'simple-json', default: '[]' })
  nodes!: NodeInstance[];

  @Column({ type: 'simple-json', default: '[]' })
  connections!: Connection[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @ManyToOne(() => AppEntity, (app) => app.flows, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'appId' })
  app?: AppEntity;
}
```

---

## 3. Tool Name Generation Utility

### packages/backend/src/utils/tool-name.ts

```typescript
export function toSnakeCase(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 100);
}

export async function generateUniqueToolName(
  appId: string,
  baseName: string,
  flowRepository: Repository<FlowEntity>,
  excludeNodeId?: string
): Promise<string> {
  const flows = await flowRepository.find({ where: { appId } });

  const existingNames = new Set<string>();
  for (const flow of flows) {
    for (const node of flow.nodes) {
      if (node.type === 'UserIntent' && node.id !== excludeNodeId) {
        const params = node.parameters as UserIntentNodeParameters;
        if (params.toolName) {
          existingNames.add(params.toolName);
        }
      }
    }
  }

  const snakeName = toSnakeCase(baseName);
  if (!existingNames.has(snakeName)) {
    return snakeName;
  }

  let suffix = 2;
  while (existingNames.has(`${snakeName}_${suffix}`)) {
    suffix++;
  }
  return `${snakeName}_${suffix}`;
}
```

---

## 4. Update Node Service

### packages/backend/src/node/node.service.ts

```typescript
async addNode(flowId: string, request: AddNodeRequest): Promise<NodeInstance> {
  const flow = await this.flowRepository.findOneOrFail({ where: { id: flowId } });

  const node: NodeInstance = {
    id: randomUUID(),
    type: request.type,
    name: request.name,
    position: request.position,
    parameters: { ...request.parameters },
  };

  // Auto-generate toolName for UserIntent nodes
  if (node.type === 'UserIntent') {
    const params = node.parameters as UserIntentNodeParameters;
    params.toolName = await generateUniqueToolName(
      flow.appId,
      node.name,
      this.flowRepository
    );
    params.isActive = params.isActive ?? true;
  }

  flow.nodes.push(node);
  await this.flowRepository.save(flow);

  return node;
}

async updateNode(flowId: string, nodeId: string, request: UpdateNodeRequest): Promise<NodeInstance> {
  const flow = await this.flowRepository.findOneOrFail({ where: { id: flowId } });
  const nodeIndex = flow.nodes.findIndex(n => n.id === nodeId);

  if (nodeIndex === -1) {
    throw new NotFoundException('Node not found');
  }

  const node = flow.nodes[nodeIndex];

  // If name changed for UserIntent, regenerate toolName
  if (node.type === 'UserIntent' && request.name && request.name !== node.name) {
    const params = node.parameters as UserIntentNodeParameters;
    params.toolName = await generateUniqueToolName(
      flow.appId,
      request.name,
      this.flowRepository,
      node.id
    );
  }

  // Apply updates
  if (request.name) node.name = request.name;
  if (request.position) node.position = request.position;
  if (request.parameters) {
    node.parameters = { ...node.parameters, ...request.parameters };
  }

  flow.nodes[nodeIndex] = node;
  await this.flowRepository.save(flow);

  return node;
}
```

---

## 5. Update MCP Tool Service

### packages/backend/src/mcp/mcp.tool.ts

```typescript
async listTools(appSlug: string): Promise<McpTool[]> {
  const app = await this.appRepository.findOne({
    where: { slug: appSlug },
    relations: ['flows'],
  });

  if (!app) {
    throw new NotFoundException('App not found');
  }

  const tools: McpTool[] = [];

  for (const flow of app.flows) {
    if (!flow.isActive) continue;

    for (const node of flow.nodes) {
      if (node.type !== 'UserIntent') continue;

      const params = node.parameters as UserIntentNodeParameters;
      if (params.isActive === false) continue;

      tools.push({
        name: params.toolName,
        description: params.toolDescription,
        inputSchema: this.buildInputSchema(params.parameters || []),
      });
    }
  }

  return tools;
}

async executeTool(
  appSlug: string,
  toolName: string,
  input: Record<string, unknown>
): Promise<McpToolResponse> {
  // Find the trigger by toolName
  const app = await this.appRepository.findOne({
    where: { slug: appSlug },
    relations: ['flows'],
  });

  if (!app) {
    throw new NotFoundException('App not found');
  }

  let targetFlow: FlowEntity | null = null;
  let targetTrigger: NodeInstance | null = null;

  for (const flow of app.flows) {
    for (const node of flow.nodes) {
      if (node.type === 'UserIntent') {
        const params = node.parameters as UserIntentNodeParameters;
        if (params.toolName === toolName) {
          targetFlow = flow;
          targetTrigger = node;
          break;
        }
      }
    }
    if (targetTrigger) break;
  }

  if (!targetFlow || !targetTrigger) {
    throw new NotFoundException(`Tool '${toolName}' not found`);
  }

  // Execute nodes reachable from this trigger
  const reachableNodes = this.getNodesReachableFrom(
    targetTrigger.id,
    targetFlow.nodes,
    targetFlow.connections
  );

  return this.executeNodes(reachableNodes, targetFlow, input);
}
```

---

## 6. Update UserIntent Node Definition

### packages/nodes/src/nodes/UserIntentNode.ts

```typescript
export const UserIntentNode: NodeTypeDefinition = {
  name: 'UserIntent',
  displayName: 'User Intent',
  icon: 'zap',
  group: ['flow', 'trigger'],
  category: 'trigger',
  description: 'Defines when the AI should trigger this flow based on user intent',

  inputs: [],
  outputs: ['main'],

  defaultParameters: {
    whenToUse: '',
    whenNotToUse: '',
    toolName: '',           // Auto-generated
    toolDescription: '',    // Required
    parameters: [],
    isActive: true,
  },

  async execute(context: ExecutionContext): Promise<ExecutionResult> {
    return {
      success: true,
      output: {
        type: 'trigger',
        triggered: true,
        toolName: context.node.parameters.toolName,
      },
    };
  },
};
```

---

## 7. Frontend: Warning Icon for No-Trigger Flows

### packages/frontend/src/components/flow/FlowCard.tsx

```tsx
import { AlertTriangle } from 'lucide-react';

function FlowCard({ flow }: { flow: Flow }) {
  const hasTriggers = flow.nodes.some(n => n.type === 'UserIntent');

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <h3>{flow.name}</h3>
          {!hasTriggers && (
            <Tooltip content="This flow has no trigger nodes and cannot be executed via MCP.">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
            </Tooltip>
          )}
        </div>
      </CardHeader>
      {/* ... */}
    </Card>
  );
}
```

---

## 8. Migration Script

### Run in SQLite

Since SQLite doesn't support DROP COLUMN directly, the migration requires table recreation:

```typescript
// 1. Move tool properties to nodes (in-memory update of JSON)
// 2. Create new table without tool columns
// 3. Copy data
// 4. Drop old table
// 5. Rename new table

// This can be done via TypeORM synchronize for POC since we're using synchronize: true
```

For POC, update the entity and let TypeORM handle schema sync. Data migration:

```typescript
// packages/backend/src/seed/migrate-triggers.ts
async function migrateTriggers(flowRepository: Repository<FlowEntity>) {
  const flows = await flowRepository.find();

  for (const flow of flows) {
    // Check if already migrated (first trigger has toolName)
    const firstTrigger = flow.nodes.find(n => n.type === 'UserIntent');
    if (firstTrigger?.parameters?.toolName) continue;

    if (firstTrigger) {
      // Move flow properties to trigger
      firstTrigger.parameters = {
        ...firstTrigger.parameters,
        toolName: (flow as any).toolName || toSnakeCase(flow.name),
        toolDescription: (flow as any).toolDescription || flow.description || '',
        parameters: (flow as any).parameters || [],
        isActive: flow.isActive,
      };
    } else {
      // Create trigger with flow properties
      flow.nodes.unshift({
        id: randomUUID(),
        type: 'UserIntent',
        name: flow.name,
        position: { x: 100, y: 100 },
        parameters: {
          whenToUse: '',
          whenNotToUse: '',
          toolName: (flow as any).toolName || toSnakeCase(flow.name),
          toolDescription: (flow as any).toolDescription || flow.description || '',
          parameters: (flow as any).parameters || [],
          isActive: flow.isActive,
        },
      });
    }

    await flowRepository.save(flow);
  }
}
```

---

## Testing Checklist

1. [ ] Create flow with single trigger - tool exposed
2. [ ] Add second trigger to flow - both tools exposed
3. [ ] Deactivate one trigger - only one tool exposed
4. [ ] Rename trigger node - toolName regenerated
5. [ ] Create trigger with conflicting name - suffix added
6. [ ] Execute each trigger separately - correct parameters used
7. [ ] Flow without triggers shows warning
8. [ ] Migration preserves existing tool configurations
