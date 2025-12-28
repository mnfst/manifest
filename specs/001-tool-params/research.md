# Research: MCP Tool Parameters

**Feature**: 001-tool-params
**Date**: 2025-12-28

## Research Topics

### 1. Parameter Storage Strategy

**Decision**: Store parameters as JSON column on Flow entity

**Rationale**:
- Parameters are tightly coupled to flows (1:N relationship with clear ownership)
- Spec assumes storage as part of flow entity (not separate table)
- TypeORM `simple-json` column type already used in codebase (ViewEntity.mockData)
- Simplifies queries (no joins needed to fetch flow with parameters)
- POC scope favors simplicity over normalization

**Alternatives Considered**:
| Alternative | Why Rejected |
|-------------|--------------|
| Separate Parameter table with foreign key | Adds complexity for POC; would require migrations and joins |
| Embedded entity with TypeORM | More complex than simple-json; overkill for this use case |

### 2. Parameter Validation Approach

**Decision**: Validate parameters on both frontend (immediate feedback) and backend (data integrity)

**Rationale**:
- Frontend validation provides instant UX feedback
- Backend validation ensures data integrity regardless of client
- Shared types package enables reusable validation logic
- Follows existing pattern in codebase (e.g., toolName validation)

**Validation Rules**:
- Name: Required, non-empty, max 50 chars, unique within flow
- Type: Must be one of: string, number, integer, boolean
- Optional: Boolean flag (defaults to false)

### 3. UI Component Strategy

**Decision**: Create reusable ParameterEditor component for both create and edit flows

**Rationale**:
- Single component reduces duplication
- Follows existing pattern (forms share input components)
- Component handles add/remove/edit operations
- Can be embedded in both CreateFlowModal and EditFlowForm

**Component Structure**:
- ParameterEditor: List of parameters with add button
- ParameterRow: Single parameter with name input, type dropdown, optional checkbox, remove button

### 4. Parameter Type Definitions

**Decision**: Use TypeScript union type for parameter types

**Rationale**:
- Matches spec requirements exactly (string, number, integer, boolean)
- Type-safe at compile time
- Aligns with JSON Schema primitive types (MCP standard)

```typescript
type ParameterType = 'string' | 'number' | 'integer' | 'boolean';

interface FlowParameter {
  name: string;
  type: ParameterType;
  optional: boolean;
}
```

### 5. API Contract Design

**Decision**: Extend existing flow endpoints rather than creating new parameter-specific endpoints

**Rationale**:
- Parameters are always created/updated with flows
- Reduces API surface area
- Simplifies frontend state management
- Existing PATCH /api/flows/:flowId can accept parameters array
- Existing POST /api/apps/:appId/flows can accept parameters array

**Endpoint Changes**:
- `POST /api/apps/:appId/flows`: Add optional `parameters` field to request body
- `PATCH /api/flows/:flowId`: Add optional `parameters` field to request body
- `GET /api/flows/:flowId`: Response already includes full flow; parameters included automatically

### 6. Parameter Order Preservation

**Decision**: Preserve array order as-is; order determined by array index

**Rationale**:
- Spec requires order preservation (FR-012)
- JSON arrays maintain insertion order
- No explicit `order` field needed for POC
- Frontend manages order through array manipulation (add appends, remove splices)

### 7. Flow Card Display Format

**Decision**: Display parameter count alongside view count with separator

**Rationale**:
- Spec explicitly requests "close to number of views"
- Format: `{paramCount} params • {viewCount} views`
- Consistent with existing info display patterns
- Zero params shown as "0 params" for consistency

## Summary

All research topics resolved. No NEEDS CLARIFICATION items remain. Ready for Phase 1 design.

| Topic | Decision |
|-------|----------|
| Storage | JSON column on Flow entity |
| Validation | Frontend + Backend |
| UI | Reusable ParameterEditor component |
| Types | TypeScript union + interface |
| API | Extend existing flow endpoints |
| Order | Array index (implicit) |
| Display | `{count} params • {count} views` |
