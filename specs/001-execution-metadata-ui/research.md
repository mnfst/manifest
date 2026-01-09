# Research: Execution Metadata and Usage UI

**Feature**: 001-execution-metadata-ui
**Date**: 2026-01-08

## Research Questions

### 1. Execution Metadata Interface Design

**Question**: What properties should the standardized `_execution` metadata interface include, and which properties are node-type-specific?

**Decision**: Create a base `ExecutionMetadata` interface with common properties, extended by node-type-specific interfaces.

**Rationale**:
- All nodes need: `success` (boolean), `error` (optional string)
- Nodes with external calls need: `durationMs` (number)
- API nodes need: `httpStatus` (number), `httpStatusText` (string)
- Transform nodes need: `durationMs` (number)
- Trigger/Return/Interface nodes: minimal metadata (just success)

**Interface Design**:
```typescript
// Base metadata for all nodes
interface ExecutionMetadata {
  success: boolean;
  error?: string;
  durationMs?: number;
}

// Extended for API calls
interface ApiExecutionMetadata extends ExecutionMetadata {
  httpStatus?: number;
  httpStatusText?: string;
  requestUrl?: string;
}

// Extended for transforms
interface TransformExecutionMetadata extends ExecutionMetadata {
  durationMs: number; // Required for transforms
}
```

**Alternatives Considered**:
1. Single flat interface with all optional properties - rejected because it doesn't communicate which properties are relevant per node type
2. Completely separate interfaces per node type - rejected because it loses the shared base contract

---

### 2. Node Output Structure Pattern

**Question**: How should node output be structured to have data at root with `_execution` property?

**Decision**: Use spread pattern: `{ ...transformedData, _execution: { ... } }`

**Rationale**:
- Downstream nodes can access data directly (e.g., `input.body` not `input.data.body`)
- `_execution` is namespaced with underscore to avoid collisions with user data
- Primitive outputs wrapped in `_value` property

**Pattern**:
```typescript
// Object output
{
  field1: "value",
  field2: 123,
  _execution: { success: true }
}

// Primitive output
{
  _value: "some string",
  _execution: { success: true }
}

// Error case
{
  _execution: { success: false, error: "Something went wrong" }
}
```

**Alternatives Considered**:
1. Nested data: `{ data: {...}, meta: {...} }` - rejected per user requirement (data at root)
2. Symbol key for metadata - rejected because not JSON-serializable

---

### 3. UI Patterns for Execution Status Display

**Question**: What UI patterns from workflow tools should we adopt for status display?

**Decision**: Combine patterns from GitHub Actions, Zapier, and n8n for the best UX.

**Research Findings**:

| Tool | Pattern | Pros | Cons |
|------|---------|------|------|
| GitHub Actions | Timeline with colored dots, expandable steps | Clear visual hierarchy | Complex for simple flows |
| Zapier | Step cards with status icons, error highlighted | Quick error identification | Limited detail |
| n8n | Node-based view with inline status | Matches our flow paradigm | Requires custom implementation |

**Adopted Patterns**:
1. **Colored status indicators**: Green (success), Red (error), Orange (pending) - universal pattern
2. **Error prominence**: Error messages displayed in red banner above collapsed data - from Zapier
3. **Inline status icons**: Checkmark/X/spinner icons in node headers - from n8n
4. **Duration display**: Show timing inline with status - from GitHub Actions

**Alternatives Considered**:
1. Toast notifications for errors - rejected because errors get missed
2. Separate error log panel - rejected because it fragments the experience

---

### 4. Execution Data Separation in UI

**Question**: How should `_execution` metadata be visually separated from actual output data?

**Decision**: Create a dedicated "Execution Info" section above the data viewer.

**Rationale**:
- Users need to see status at a glance (SC-001, SC-002)
- Error messages must be prominent (FR-009)
- Data should still be explorable for debugging

**UI Structure**:
```
┌─────────────────────────────────────┐
│ Node Name              ✓ Success    │ <- Header with status icon
├─────────────────────────────────────┤
│ Duration: 234ms                     │ <- Execution info (optional)
├─────────────────────────────────────┤
│ ▼ Output Data                       │ <- Collapsible data viewer
│   { ... }                           │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Node Name              ✗ Failed     │ <- Red status for errors
├─────────────────────────────────────┤
│ ⚠️ Error: Connection timeout        │ <- Prominent error banner
├─────────────────────────────────────┤
│ Duration: 30000ms                   │
├─────────────────────────────────────┤
│ ▼ Output Data                       │
└─────────────────────────────────────┘
```

**Alternatives Considered**:
1. Inline `_execution` in JSON viewer - rejected because error not immediately visible
2. Separate tab for metadata - rejected because adds navigation overhead

---

### 5. Backward Compatibility

**Question**: How do we handle existing executions stored in the database with old output format?

**Decision**: Support both formats in the UI with graceful degradation.

**Rationale**:
- Existing execution history should remain viewable
- Migration of historical data is unnecessary for POC
- UI can detect format and adapt display

**Approach**:
```typescript
// Detection logic in UI
const hasExecutionMetadata = outputData && '_execution' in outputData;
const isSuccess = hasExecutionMetadata
  ? outputData._execution.success
  : nodeStatus === 'completed'; // Fall back to node-level status

const errorMessage = hasExecutionMetadata
  ? outputData._execution.error
  : nodeError; // Fall back to stored error field
```

**Alternatives Considered**:
1. Data migration script - rejected as overkill for POC
2. Only show new format - rejected because loses existing debug data

---

## Summary of Decisions

| Topic | Decision |
|-------|----------|
| Interface structure | Base `ExecutionMetadata` with node-specific extensions |
| Output pattern | Data at root, `_execution` property for metadata |
| Primitive handling | Wrap in `{ _value: primitive, _execution: {...} }` |
| Status colors | Green (success), Red (error), Orange (pending) |
| Error display | Dedicated banner above collapsed data |
| Duration display | Inline in execution info section |
| Backward compatibility | Detect format, graceful degradation |
