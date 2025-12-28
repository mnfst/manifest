# Research: Simplified Flow Creation

**Feature**: 001-flow-creation
**Date**: 2025-12-28

## Research Tasks Completed

### 1. Snake Case Conversion for Tool Name

**Decision**: Use a simple regex-based conversion function

**Rationale**:
- The codebase already uses `slugify` package for slug generation (backend dependency)
- However, slugify produces kebab-case (dashes), not snake_case (underscores)
- A simple custom function is more appropriate and keeps the logic transparent
- The conversion rules from FR-003 are straightforward:
  - Convert to lowercase
  - Replace spaces with underscores
  - Remove special characters (keep only alphanumeric and underscores)
  - Collapse multiple underscores into single

**Alternatives Considered**:
- `slugify` with custom replacement: Would need post-processing anyway
- `lodash.snakeCase`: Would add unnecessary dependency for simple operation
- Backend-only conversion: Would require round-trip for preview; client-side is better for UX

**Implementation Pattern**:
```typescript
function toSnakeCase(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')  // Remove special chars
    .trim()
    .replace(/\s+/g, '_')          // Spaces to underscores
    .replace(/_+/g, '_')           // Collapse multiple underscores
    .replace(/^_|_$/g, '');        // Trim leading/trailing underscores
}
```

---

### 2. React Flow Placeholder Node Pattern

**Decision**: Create custom React Flow node types for placeholders

**Rationale**:
- @xyflow/react supports custom node types (already used: `viewNode`, `userIntentNode`)
- Placeholder nodes can be added to the nodes array conditionally
- Clicking a node can be handled via the `onClick` prop on the node data
- Centering is achieved by calculating position based on viewport

**Alternatives Considered**:
- Overlay div outside React Flow: Would require manual positioning and not integrate with pan/zoom
- React Flow Background component: Not suitable for interactive elements
- Static positioned element: Would not follow canvas interactions

**Implementation Pattern**:
- New node type: `addUserIntentNode` - shown when flow has no `toolDescription`
- New node type: `addViewNode` - shown when flow has user intent but no views
- Nodes positioned at canvas center: `{ x: viewportWidth/2 - nodeWidth/2, y: viewportHeight/2 - nodeHeight/2 }`
- Node click opens respective modal

---

### 3. Empty Flow State Detection

**Decision**: Use `toolDescription` field as indicator for user intent presence

**Rationale**:
- Existing Flow entity has `toolDescription` as required field conceptually
- When `toolDescription` is empty string or undefined, user intent hasn't been set
- No schema changes required - just change creation default
- Backend already supports `UpdateFlowRequest` with partial updates for setting user intent

**Alternatives Considered**:
- New boolean field `hasUserIntent`: Would require schema migration
- Separate UserIntent entity: Overengineering for current needs
- Check `whenToUse` field: Less reliable as it's optional

**Detection Logic**:
```typescript
const hasUserIntent = flow.toolDescription && flow.toolDescription.trim().length > 0;
const hasViews = flow.views && flow.views.length > 0;

// Show states:
// - !hasUserIntent → show AddUserIntentNode
// - hasUserIntent && !hasViews → show UserIntentNode + AddViewNode
// - hasUserIntent && hasViews → show UserIntentNode + ViewNodes (existing)
```

---

### 4. Modal Reuse Strategy

**Decision**: Reuse existing `UserIntentModal` and view creation modal as-is

**Rationale**:
- User Intent modal already has all required fields (toolDescription, whenToUse, whenNotToUse)
- It already calls `updateFlow` API to save changes
- View creation already works for adding views to a flow
- No changes needed to these components

**Alternatives Considered**:
- Create new "first-time" variants: Unnecessary complexity
- Wizard-style modal combining user intent + view: Changes user mental model too much

---

### 5. Backend Simplification

**Decision**: Remove AI generation pipeline entirely from flow creation path

**Rationale**:
- The `agentService.generateFlow()` call is the source of the prompt requirement
- Without prompt, there's nothing to generate
- The AI tools (layout-selector, tool-generator, mock-data-generator) remain useful for other features
- Clean removal of the flow generation method, keeping other agent functionality

**Files to Modify**:
- `flow.controller.ts`: Replace AI generation with direct flow creation
- `agent.service.ts`: Remove or deprecate `generateFlow` method
- `flow.service.ts`: Ensure `create` accepts name/description directly

**Alternatives Considered**:
- Keep generateFlow for future use: Would add confusion; better to remove cleanly
- Feature flag: Overengineering for POC

---

## Summary

All technical approaches are straightforward with no blocking unknowns. The feature is primarily a simplification/refactoring effort that:

1. Removes code (prompt handling, AI generation for flow creation)
2. Modifies existing components (modal, flow diagram, controller)
3. Adds minimal new code (snake_case helper, placeholder node components)

No external research or additional dependencies required.
