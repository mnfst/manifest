# Research: Nodes Package Refactor

**Feature**: 017-nodes-refactor
**Date**: 2025-12-29
**Status**: Complete

## Research Areas

### 1. n8n Node Architecture Patterns

**Decision**: Adopt simplified n8n-style architecture with node type definitions and JSON storage

**Rationale**: n8n's architecture provides a proven pattern for:
- Storing workflows as JSON with nodes and connections arrays
- Defining node types with standardized properties (name, displayName, icon, group, description, execute)
- Keeping node definitions separate from the core application

**Key Findings**:

n8n's INodeType interface defines:
```typescript
interface INodeType {
  description: INodeTypeDescription;
  execute?(this: IExecuteFunctions): Promise<INodeExecutionData[][]>;
}

interface INodeTypeDescription {
  displayName: string;       // "Weather Alert"
  name: string;              // "weatherAlert"
  group: string[];           // ['transform', 'input', 'output']
  version: number;
  description?: string;
  icon?: string;
  inputs?: string[];         // ['main']
  outputs?: string[];        // ['main']
  properties: INodeProperties[];
}
```

Workflow storage structure:
```typescript
interface WorkflowEntity {
  id: string;
  name: string;
  nodes: INode[];           // JSON array
  connections: IConnections; // JSON object
  active: boolean;
}

interface INode {
  id: string;
  name: string;
  type: string;
  position: [number, number];
  parameters: Record<string, unknown>;
}
```

**Simplified Adaptation for Our Project**:
```typescript
interface NodeTypeDefinition {
  name: string;           // 'Interface' | 'Return' | 'CallFlow'
  displayName: string;    // 'Display Interface'
  icon: string;           // 'layout-template'
  group: string[];        // ['views']
  description: string;
  execute: (context: ExecutionContext) => Promise<unknown>;
}

interface NodeInstance {
  id: string;
  type: string;
  name: string;
  position: { x: number; y: number };
  parameters: Record<string, unknown>;
}

interface Connection {
  sourceNodeId: string;
  sourceHandle: string;
  targetNodeId: string;
  targetHandle: string;
}
```

**Alternatives Considered**:
- **Keep separate entities**: Rejected - causes proliferation of tables and complex joins
- **Use full n8n complexity**: Rejected - overkill for our 3 node types

---

### 2. TypeORM JSON Columns with SQLite

**Decision**: Use `simple-json` column type with fetch-merge-save update pattern

**Rationale**:
- SQLite doesn't support native JSON columns, `simple-json` stores as TEXT
- TypeORM 0.3.20 provides seamless serialization/deserialization
- Existing codebase already uses this pattern successfully (AppEntity.themeVariables, FlowEntity.parameters)

**Key Findings**:

Column definition:
```typescript
@Column({ type: 'simple-json', default: '[]' })
nodes!: NodeInstance[];

@Column({ type: 'simple-json', default: '[]' })
connections!: Connection[];
```

Partial JSON update pattern (from existing app.service.ts):
```typescript
async updateNode(flowId: string, nodeId: string, updates: Partial<NodeInstance>): Promise<Flow> {
  const entity = await this.flowRepository.findOne({ where: { id: flowId } });
  if (!entity) throw new NotFoundException(`Flow ${flowId} not found`);

  // Immutable update pattern
  entity.nodes = entity.nodes.map(node =>
    node.id === nodeId ? { ...node, ...updates } : node
  );

  return this.flowRepository.save(entity);
}
```

Querying JSON (limited in SQLite - filter in application):
```typescript
async findNodesByType(flowId: string, type: string): Promise<NodeInstance[]> {
  const entity = await this.flowRepository.findOne({ where: { id: flowId } });
  return entity?.nodes.filter(n => n.type === type) || [];
}
```

**Validation with Zod** (existing pattern):
```typescript
const NodeInstanceSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['Interface', 'Return', 'CallFlow']),
  name: z.string().min(1).max(100),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  parameters: z.record(z.unknown()),
});
```

**Alternatives Considered**:
- **PostgreSQL JSONB**: Rejected - project uses SQLite for POC simplicity
- **Separate entities with joins**: Rejected - this is what we're moving away from

---

### 3. React Flow Integration Patterns

**Decision**: Continue using existing @xyflow/react patterns with JSON-based node/edge sync

**Rationale**:
- Existing FlowDiagram.tsx already implements solid patterns
- JSON storage aligns naturally with React Flow's state model
- useReactFlow() hook provides methods for serialization

**Key Findings**:

Node position persistence:
```typescript
const { getNodes, setNodes, getViewport, setViewport } = useReactFlow();

// Save positions on drag end
const onNodeDragStop = useCallback(async (event, node) => {
  const nodes = getNodes();
  await api.updateFlowNodes(flowId, nodes.map(n => ({
    id: n.id,
    position: n.position,
  })));
}, [flowId, getNodes]);

// Restore from backend
useEffect(() => {
  const loadFlow = async () => {
    const flow = await api.getFlow(flowId);
    setNodes(flow.nodes.map(n => ({
      id: n.id,
      type: nodeTypeMap[n.type], // Map to React Flow node types
      position: n.position,
      data: n.parameters,
    })));
  };
  loadFlow();
}, [flowId, setNodes]);
```

Connection validation (from existing FlowDiagram.tsx):
```typescript
const isValidConnection: IsValidConnection = useCallback((connection) => {
  if (!connection.sourceHandle?.startsWith('action:')) return false;

  const targetNode = connection.target;
  const isValidTarget = returnNodes.some(n => n.id === targetNode) ||
                       callFlowNodes.some(n => n.id === targetNode);
  return isValidTarget;
}, [returnNodes, callFlowNodes]);
```

Dynamic handles with useUpdateNodeInternals:
```typescript
const updateNodeInternals = useUpdateNodeInternals();

useEffect(() => {
  // Re-calculate handle positions when actions change
  updateNodeInternals(nodeId);
}, [nodeId, actions]);
```

**Alternatives Considered**:
- **Custom canvas library**: Rejected - React Flow is already integrated and works well
- **Server-side rendering of canvas**: Rejected - unnecessary complexity

---

### 4. Migration Strategy

**Decision**: POC mode with TypeORM auto-sync - delete old tables, create new columns

**Rationale**:
- POC phase allows data reset (no production data to preserve)
- TypeORM synchronize: true will handle schema changes automatically
- Simplest approach for development velocity

**Migration Approach**:

1. **Add new columns to FlowEntity**:
```typescript
@Column({ type: 'simple-json', default: '[]' })
nodes!: NodeInstance[];

@Column({ type: 'simple-json', default: '[]' })
connections!: Connection[];
```

2. **Remove old entity relations** from FlowEntity (views, returnValues, callFlows)

3. **Delete old modules and entities**:
   - ViewEntity, ViewModule, ViewService, ViewController
   - ReturnValueEntity, ReturnValueModule, ReturnValueService, ReturnValueController
   - CallFlowEntity, CallFlowModule, CallFlowService, CallFlowController
   - ActionConnectionEntity, ActionConnectionModule, ActionConnectionService, ActionConnectionController
   - MockDataEntity, MockDataModule, MockDataService, MockDataController

4. **Create new Node module** with CRUD operations on JSON arrays

5. **Update frontend** to use new API structure

**If production migration needed later**:
```typescript
// Migration script pattern (for future use)
async function migrateToJsonNodes() {
  const flows = await flowRepository.find({ relations: ['views', 'returnValues', 'callFlows'] });

  for (const flow of flows) {
    flow.nodes = [
      ...flow.views.map(v => ({ id: v.id, type: 'Interface', name: v.name, position: {x:0, y:0}, parameters: { layoutTemplate: v.layoutTemplate, mockData: v.mockData } })),
      ...flow.returnValues.map(r => ({ id: r.id, type: 'Return', name: `Return ${r.order}`, position: {x:0, y:0}, parameters: { text: r.text } })),
      ...flow.callFlows.map(c => ({ id: c.id, type: 'CallFlow', name: `Call ${c.order}`, position: {x:0, y:0}, parameters: { targetFlowId: c.targetFlowId } })),
    ];
    flow.connections = []; // Would need to convert ActionConnections
    await flowRepository.save(flow);
  }
}
```

**Alternatives Considered**:
- **Full TypeORM migration files**: Rejected - overkill for POC, synchronize: true is enabled
- **Keep old entities alongside new**: Rejected - adds complexity without benefit

---

### 5. Nodes Package Structure

**Decision**: Create `packages/nodes` as a new TypeScript package in the monorepo

**Rationale**:
- Follows n8n pattern of separating node definitions from core
- Enables future extensibility without modifying core packages
- Clean dependency graph (backend imports nodes, not vice versa)

**Package Structure**:
```
packages/nodes/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts              # Public exports
│   ├── types.ts              # NodeTypeDefinition interface
│   ├── registry.ts           # Node type registry
│   └── definitions/
│       ├── interface.node.ts # Interface node (formerly View)
│       ├── return.node.ts    # Return node (formerly ReturnValue)
│       └── call-flow.node.ts # CallFlow node
```

**Package.json**:
```json
{
  "name": "@chatgpt-app-builder/nodes",
  "version": "1.0.0",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@chatgpt-app-builder/shared": "*"
  },
  "devDependencies": {
    "typescript": "^5.7.2"
  }
}
```

**Registry Pattern**:
```typescript
// src/registry.ts
import type { NodeTypeDefinition } from './types';
import { InterfaceNode } from './definitions/interface.node';
import { ReturnNode } from './definitions/return.node';
import { CallFlowNode } from './definitions/call-flow.node';

export const nodeRegistry: Record<string, NodeTypeDefinition> = {
  Interface: InterfaceNode,
  Return: ReturnNode,
  CallFlow: CallFlowNode,
};

export function getNodeType(name: string): NodeTypeDefinition | undefined {
  return nodeRegistry[name];
}

export function getAllNodeTypes(): NodeTypeDefinition[] {
  return Object.values(nodeRegistry);
}
```

**Alternatives Considered**:
- **Embed in shared package**: Rejected - nodes have execution logic, shared is types only
- **Embed in backend package**: Rejected - loses separation of concerns benefit

---

## Summary of Decisions

| Area | Decision | Key Reason |
|------|----------|------------|
| Node Architecture | Simplified n8n pattern | Proven, extensible, not overly complex |
| JSON Storage | simple-json columns | SQLite compatible, already used in codebase |
| React Flow | Continue existing patterns | Works well, JSON aligns naturally |
| Migration | POC mode with auto-sync | Development velocity, no prod data |
| Package Structure | New `packages/nodes` | Separation of concerns, extensibility |

## Open Items

None - all clarifications resolved through research.
