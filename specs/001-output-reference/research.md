# Research: Output Reference & Trigger Node UX Improvements

**Feature Branch**: `001-output-reference`
**Date**: 2026-01-07

## Executive Summary

This research documents the existing codebase architecture to inform implementation of slug-based node references, "Use Previous Outputs" component, and trigger node UX improvements.

---

## Research Topics

### 1. Node Identification System

**Current State:**
- Nodes use **UUID (`id`)** as primary identifier
- Nodes have a display **`name`** (unique within a flow)
- UserIntent nodes additionally have **`toolName`** (auto-generated snake_case from name)

**Decision**: Add a new `slug` field to nodes
- **Rationale**:
  - UUIDs are not human-readable (`abc-123-def` vs `weather_trigger`)
  - The existing `toolName` is only for UserIntent nodes and has different semantics (MCP tool identity)
  - A dedicated `slug` field allows all node types to have human-readable references
- **Alternatives Considered**:
  - Use `name` directly: Rejected - names can contain spaces/special chars, not suitable for template syntax
  - Use existing `toolName`: Rejected - only exists on UserIntent nodes
  - Generate slug on-the-fly: Rejected - references would break if name changes

**Implementation Approach**:
- Generate `slug` at node creation using same logic as `toolName` (snake_case, unique suffix)
- Store `slug` in NodeInstance alongside `id` and `name`
- Update slug if user renames node (with downstream reference update)

---

### 2. How Outputs Are Currently Referenced

**Current State:**
- Connections reference nodes by **UUID**
- ApiCall nodes support template syntax: `{{nodeId.path}}` (using UUID)
- No UI assistance for building these references

**Decision**: Migrate to slug-based references `{{ nodeSlug.path }}`
- **Rationale**: Human-readable references improve debugging and workflow maintainability
- **Alternatives Considered**:
  - Keep UUID references: Rejected - user requirement for human-readable references
  - Dual support (UUID and slug): Rejected - adds complexity, prefer clean migration

**Implementation Approach**:
- Add slug resolution in execution engine alongside/instead of ID resolution
- Update template variable parser to resolve slugs
- Provide migration for existing flows (convert UUID refs to slugs)

---

### 3. Edit User Intent Modal Structure

**Current State:**
- **File**: `packages/frontend/src/components/flow/NodeEditModal.tsx`
- Unified modal for all node types with tabs:
  1. **Configuration Tab**: Name, tool config, parameters, AI guidance
  2. **Schema Tab**: NodeSchemaPanel showing input/output schemas
- MCP exposure is a toggle within "MCP Tool Configuration" section
- Parameters section has Add/Remove buttons for FlowParameter items

**Decision**: Enhance existing modal structure
- **Rationale**: Keep consistent UX, add "Use Previous Outputs" to modals
- **Changes Required**:
  - Replace "Expose as MCP tool" checkbox/toggle text with "Active" label
  - Add "Use Previous Outputs" component to configuration areas that accept template variables
  - Improve schema display to show static vs dynamic fields

---

### 4. Schema System Architecture

**Current State:**
- **Types**: `packages/shared/src/types/schema.ts` defines JSONSchema types
- **Validator**: `packages/shared/src/utils/schemaValidator.ts` with `createUserIntentOutputSchema()`
- **Service**: `packages/backend/src/node/schema/schema.service.ts` handles validation
- UserIntent output schema structure:
  ```typescript
  {
    type: 'object',
    properties: {
      type: { const: 'trigger' },        // Static
      triggered: { boolean },             // Static
      toolName: { string },               // Static
      ...parameterProperties              // Dynamic from user config
    }
  }
  ```

**Decision**: Extend schema metadata to indicate static vs dynamic fields
- **Rationale**: Spec requires clear visual distinction in schema panel
- **Implementation Approach**:
  - Add `x-field-source: 'static' | 'dynamic'` extension to schema properties
  - Update SchemaViewer to render with appropriate labels/badges

---

### 5. Upstream Node Discovery

**Current State:**
- Connections stored as array in flow entity
- No API to get "all upstream nodes" for a given node
- Frontend has access to full nodes/connections arrays via React Flow

**Decision**: Implement client-side upstream traversal
- **Rationale**:
  - All data already available in frontend (nodes + connections)
  - No need for backend API call
  - Real-time updates as flow changes
- **Implementation Approach**:
  - Create utility function `getUpstreamNodes(nodeId, nodes, connections)` returning ordered list
  - Use graph traversal (BFS/DFS) from target node following connections backwards
  - Return nodes with their output schemas

---

### 6. Output Field Discovery

**Current State:**
- Output schemas available via SchemaService
- Schemas are JSON Schema format with nested properties
- Schema panel already renders property trees

**Decision**: Flatten schema for dropdown display
- **Rationale**: Users need simple list of "paths" they can reference
- **Implementation Approach**:
  - Create `flattenSchemaProperties(schema)` utility
  - Returns array: `[{ path: 'response.data.items', type: 'array', description: '...' }]`
  - Handle nested objects by recursively building dot-notation paths
  - Use existing schema descriptions where available

---

## Technical Findings

### Key Files to Modify

| File | Changes |
|------|---------|
| `packages/shared/src/types/node.ts` | Add `slug` field to NodeInstance |
| `packages/backend/src/node/node.service.ts` | Generate slug on node create/rename |
| `packages/nodes/src/nodes/*.ts` | Add `x-field-source` to schema properties |
| `packages/frontend/src/components/flow/NodeEditModal.tsx` | Add "Use Previous Outputs" component, update toggle label |
| `packages/frontend/src/components/node/NodeSchemaPanel.tsx` | Display static/dynamic badges |
| `packages/frontend/src/lib/schemaUtils.ts` | Add `flattenSchemaProperties()` function |
| `packages/backend/src/mcp/mcp.tool.ts` | Support slug-based template resolution |

### New Files to Create

| File | Purpose |
|------|---------|
| `packages/frontend/src/components/common/UsePreviousOutputs.tsx` | Dropdown component for output reference builder |
| `packages/shared/src/utils/slug.ts` | Slug generation and validation utilities |
| `packages/frontend/src/hooks/useUpstreamNodes.ts` | Hook for computing upstream nodes with schemas |

### Dependencies

- Builds on existing 001-io-schemas feature (schema types, validation, display)
- Uses existing node/connection data structures
- Leverages existing toast/clipboard utilities

---

## Open Questions (Resolved)

| Question | Resolution |
|----------|------------|
| Should slugs be editable by users? | No - auto-generated from name to ensure valid format |
| What happens to references when node renamed? | Slugs update, references auto-migrate |
| How to handle circular references? | Not applicable - connections are DAG by design |
| Default selected node in dropdown? | Previous connected node (immediate upstream) |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking existing flows with UUID refs | Medium | High | Migration script, dual-resolve during transition |
| Slug collision edge cases | Low | Medium | Robust uniqueness suffix logic |
| Performance with large flows | Low | Low | Client-side traversal is O(n), acceptable for POC |

---

## Next Steps

1. Proceed to data-model.md with slug field addition
2. Generate API contracts for any new endpoints (likely none - client-side logic)
3. Create quickstart.md with user workflow scenarios
