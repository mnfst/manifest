# Data Model: UI Selection Architecture Refactor

**Feature Branch**: `001-ui-selection`
**Date**: 2026-01-07

## Entities

### 1. StatCardData

Represents a single statistic item displayed in the Stat Card component.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| label | string | Yes | Metric name (e.g., "Sales", "Orders") |
| value | string \| number | Yes | Display value (e.g., "$12,543", 342) |
| change | number | No | Percentage change (e.g., 12.5, -3.2) |
| changeLabel | string | No | Description of change (e.g., "vs last month") |
| trend | "up" \| "down" \| "neutral" | No | Trend direction indicator |

**Validation Rules**:
- `label` must be non-empty string
- `value` can be string (formatted) or number (raw)
- `change` should be a valid number when provided
- `trend` defaults to "neutral" when not provided or `change` is 0

**State Transitions**: N/A (read-only data)

### 2. StatsInputData

Represents the input data structure expected by the Stat Card node.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| stats | StatCardData[] | Yes | Array of statistics to display |

**Validation Rules**:
- `stats` array must contain at least one item for meaningful display
- Empty array displays empty state

### 3. LayoutTemplate (Updated)

Represents available UI layout templates in the system.

**Previous Values**: `'table' | 'post-list'`

**New Values**: `'stat-card'`

| Value | Description | Use Case |
|-------|-------------|----------|
| stat-card | Grid of metric cards with trends | KPIs, dashboard stats, metrics overview |

### 4. NodeTypeDefinition (Unchanged)

Existing interface for defining node types. StatCardNode will implement this interface.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | Internal type name |
| displayName | string | Yes | Human-readable name |
| icon | string | Yes | Lucide icon name |
| group | string[] | Yes | Category tags |
| category | NodeTypeCategory | Yes | Node classification |
| description | string | Yes | What the node does |
| inputs | string[] | Yes | Input handle types |
| outputs | string[] | Yes | Output handle types |
| defaultParameters | Record<string, unknown> | Yes | Default param values |
| execute | function | Yes | Execution logic |
| inputSchema | JSONSchema \| null | No | Expected input structure |
| outputSchema | JSONSchema \| null | No | Guaranteed output structure |

## Relationships

```text
┌─────────────────────────┐
│   StatCardNode          │
│   (NodeTypeDefinition)  │
├─────────────────────────┤
│ inputSchema: JSONSchema │──────┐
│ outputs: []  (readonly) │      │
└─────────────────────────┘      │
                                 │ validates
                                 ▼
┌─────────────────────────┐
│    StatsInputData       │
├─────────────────────────┤
│ stats: StatCardData[]   │──────┐
└─────────────────────────┘      │
                                 │ contains
                                 ▼
┌─────────────────────────┐
│    StatCardData         │
├─────────────────────────┤
│ label: string           │
│ value: string | number  │
│ change?: number         │
│ changeLabel?: string    │
│ trend?: TrendDirection  │
└─────────────────────────┘
```

## JSON Schema Definitions

### StatCardData Schema

```json
{
  "type": "object",
  "properties": {
    "label": {
      "type": "string",
      "minLength": 1,
      "description": "Metric name displayed on the card"
    },
    "value": {
      "oneOf": [
        { "type": "string" },
        { "type": "number" }
      ],
      "description": "The metric value to display"
    },
    "change": {
      "type": "number",
      "description": "Percentage change value"
    },
    "changeLabel": {
      "type": "string",
      "description": "Label describing the change context"
    },
    "trend": {
      "type": "string",
      "enum": ["up", "down", "neutral"],
      "description": "Visual trend indicator direction"
    }
  },
  "required": ["label", "value"]
}
```

### StatsInputData Schema

```json
{
  "type": "object",
  "properties": {
    "stats": {
      "type": "array",
      "items": { "$ref": "#/definitions/StatCardData" },
      "description": "Array of statistics to display"
    }
  },
  "required": ["stats"]
}
```

## Impact on Existing Data

### LayoutTemplate Type Change

**Before**:
```typescript
type LayoutTemplate = 'table' | 'post-list';
```

**After**:
```typescript
type LayoutTemplate = 'stat-card';
```

**Migration**: Existing flows using `table` or `post-list` layout will fail validation after this change. This is an intentional breaking change as per user requirements.

### LAYOUT_REGISTRY Update

**Before**:
```typescript
const LAYOUT_REGISTRY = {
  table: { /* config */ },
  'post-list': { /* config */ }
};
```

**After**:
```typescript
const LAYOUT_REGISTRY = {
  'stat-card': {
    manifestBlock: '@manifest/stats',
    installCommand: 'npx shadcn@latest add @manifest/stats',
    useCase: 'KPIs, dashboard stats, metrics overview',
    actions: []  // Read-only, no actions
  }
};
```
