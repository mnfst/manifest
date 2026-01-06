# Data Model: Trigger Node Refactor

**Feature**: 001-trigger-node-refactor
**Date**: 2026-01-06

## Entity Changes

### NodeTypeCategory (New Enum)

Classification for node types determining their role in flow execution.

| Value | Description |
|-------|-------------|
| `trigger` | Entry points to flow execution. Output-only handles. Cannot receive incoming connections. |
| `interface` | Display UI and capture user interactions. Both input and output handles. |
| `action` | Execute operations or call other flows. Both input and output handles. |
| `return` | Terminate flow and return values. Input-only handles. |

### NodeTypeDefinition (Modified)

Added `category` field to classify node types.

| Field | Type | Description | Change |
|-------|------|-------------|--------|
| `name` | `string` | Internal type identifier (e.g., 'Interface') | Unchanged |
| `displayName` | `string` | Human-readable name shown in UI | Modified for some nodes |
| `icon` | `string` | Lucide icon name | Unchanged |
| `group` | `string[]` | Tags for filtering | Unchanged |
| `description` | `string` | What the node does | Unchanged |
| **`category`** | `NodeTypeCategory` | Node classification | **NEW** |
| `inputs` | `string[]` | Input handle identifiers | Unchanged |
| `outputs` | `string[]` | Output handle identifiers | Unchanged |
| `defaultParameters` | `Record<string, unknown>` | Default config values | Unchanged |
| `execute` | `Function` | Execution logic | Unchanged |

### NodeType (Modified Union)

Updated to include UserIntent.

```
Before: 'Interface' | 'Return' | 'CallFlow'
After:  'Interface' | 'Return' | 'CallFlow' | 'UserIntent'
```

### NodeInstance (Unchanged)

No changes to the NodeInstance structure. The `type` field will accept the new `UserIntent` value.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | UUID |
| `type` | `NodeType` | Node type identifier |
| `name` | `string` | User-provided display name |
| `position` | `Position` | Canvas coordinates `{x, y}` |
| `parameters` | `Record<string, unknown>` | Type-specific configuration |

### UserIntentNodeParameters (New)

Parameters specific to UserIntent nodes.

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `whenToUse` | `string` | No | Max 500 chars | Scenarios when AI should use this flow |
| `whenNotToUse` | `string` | No | Max 500 chars | Scenarios when AI should NOT use this flow |

### Flow (Modified)

Removed user intent properties that are now stored in UserIntentNode.

| Field | Type | Description | Change |
|-------|------|-------------|--------|
| `id` | `string` | UUID | Unchanged |
| `appId` | `string` | Parent app ID | Unchanged |
| `name` | `string` | Flow name | Unchanged |
| `description` | `string?` | Optional description | Unchanged |
| `toolName` | `string` | MCP tool name | Unchanged |
| `toolDescription` | `string` | What the flow does | Unchanged |
| ~~`whenToUse`~~ | ~~`string?`~~ | ~~When AI should use~~ | **REMOVED** |
| ~~`whenNotToUse`~~ | ~~`string?`~~ | ~~When AI should not use~~ | **REMOVED** |
| `isActive` | `boolean` | Flow enabled state | Unchanged |
| `parameters` | `FlowParameter[]?` | Flow-level parameters | Unchanged |
| `nodes` | `NodeInstance[]` | Nodes in this flow | Unchanged |
| `connections` | `Connection[]` | Node connections | Unchanged |
| `createdAt` | `string` | Creation timestamp | Unchanged |
| `updatedAt` | `string` | Update timestamp | Unchanged |

### Connection (Unchanged)

No changes to connection structure.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | UUID |
| `sourceNodeId` | `string` | Source node ID |
| `sourceHandle` | `string` | Source handle identifier |
| `targetNodeId` | `string` | Target node ID |
| `targetHandle` | `string` | Target handle identifier |

## Node Type Registry

After refactor:

| Internal Name | Display Name | Category | Inputs | Outputs |
|---------------|--------------|----------|--------|---------|
| `UserIntent` | "User Intent" | `trigger` | `[]` | `['main']` |
| `Interface` | "Agentic Interface" | `interface` | `['main']` | `['action:submit', 'action:click', 'action:select']` |
| `CallFlow` | "Call Flow" | `action` | `['main']` | `['main']` |
| `Return` | "Return Value" | `return` | `['main']` | `[]` |

## Validation Rules

### UserIntentNode Validation

- `whenToUse`: Optional, max 500 characters
- `whenNotToUse`: Optional, max 500 characters
- Cannot have incoming connections (enforced by UI - no target handles)

### Connection Validation (Existing + New)

- Source and target nodes must exist
- Cannot create self-connections
- Cannot create cycles
- **NEW**: Cannot target a trigger node (no target handles to connect to)

## Migration

### Migration Script Logic

```
FOR each flow in flows:
  IF flow.whenToUse OR flow.whenNotToUse:
    CREATE node:
      id: generate UUID
      type: 'UserIntent'
      name: 'User Intent'
      flowId: flow.id
      position: {x: 50, y: 200}
      parameters: {
        whenToUse: flow.whenToUse,
        whenNotToUse: flow.whenNotToUse
      }

    SET flow.whenToUse = NULL
    SET flow.whenNotToUse = NULL
```

### Migration Order

1. Run migration script to create UserIntentNodes
2. Deploy code changes (schema sync will remove columns from Flow)

## Entity Relationship Diagram

```
┌─────────────────┐
│      App        │
├─────────────────┤
│ id              │
│ name            │
│ ...             │
└────────┬────────┘
         │ 1:N
         ▼
┌─────────────────┐
│      Flow       │
├─────────────────┤
│ id              │
│ appId           │
│ name            │
│ toolName        │
│ toolDescription │ ← Kept (describes flow purpose)
│ isActive        │
│ parameters[]    │
└────────┬────────┘
         │ 1:N
         ▼
┌─────────────────┐      ┌─────────────────┐
│  NodeInstance   │      │   Connection    │
├─────────────────┤      ├─────────────────┤
│ id              │◄────►│ sourceNodeId    │
│ flowId          │      │ sourceHandle    │
│ type            │      │ targetNodeId    │
│ name            │      │ targetHandle    │
│ position        │      └─────────────────┘
│ parameters      │
└─────────────────┘
         │
         │ type determines
         ▼
┌─────────────────────────────────────────────────────────┐
│                    Node Types                           │
├──────────────┬──────────────┬───────────┬──────────────┤
│ UserIntent   │ Interface    │ CallFlow  │ Return       │
│ (trigger)    │ (interface)  │ (action)  │ (return)     │
│ outputs only │ inputs+outputs│ in+out   │ inputs only  │
└──────────────┴──────────────┴───────────┴──────────────┘
```
