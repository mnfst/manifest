# Data Model: Dynamic Node Library

**Feature**: 088-dynamic-node-library
**Date**: 2026-01-06

## Overview

This feature involves **no data model changes**. The only modification is to a TypeScript constant (the `category` field in `CallFlowNode`).

## Existing Entities (Reference Only)

### NodeTypeDefinition

Defined in `packages/nodes/src/types.ts`:

| Field | Type | Description |
|-------|------|-------------|
| name | string | Internal type name (e.g., 'CallFlow') |
| displayName | string | Human-readable name (e.g., 'Call Flow') |
| icon | string | Lucide icon name |
| group | string[] | Tags for grouping (e.g., ['flow', 'logic']) |
| **category** | NodeTypeCategory | **The field being changed** |
| description | string | User-facing description |
| inputs | string[] | Input handle types |
| outputs | string[] | Output handle types |
| defaultParameters | Record<string, unknown> | Default parameter values |
| execute | function | Execution logic |

### NodeTypeCategory

Defined in `packages/shared/src/types/node.ts`:

```typescript
type NodeTypeCategory = 'trigger' | 'interface' | 'action' | 'return';
```

No changes to this type.

## Change Summary

| Entity | Field | Current Value | New Value |
|--------|-------|---------------|-----------|
| CallFlowNode | category | 'action' | 'return' |

## Database Impact

**None** - Node type definitions are code constants, not database records. No migrations required.

## API Impact

The `GET /api/node-types` response will show CallFlow under the "return" category instead of "action". This is the intended behavior change.
