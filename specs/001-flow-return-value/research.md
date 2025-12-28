# Research: Flow Return Value Support

**Feature Branch**: `001-flow-return-value`
**Created**: 2025-12-28
**Status**: Complete

## Research Questions

### 1. MCP Protocol Text Content Format

**Question**: What is the exact format for returning text content from MCP tools?

**Decision**: Use the MCP protocol unstructured text content format

**Rationale**: The MCP specification (2025-06-18) defines a clear format for text content in tool results:
```json
{
  "content": [
    {
      "type": "text",
      "text": "The actual text content"
    }
  ],
  "isError": false
}
```

**Alternatives Considered**:
- Structured content with `structuredContent` field - Rejected because the feature specifically targets unstructured text return values
- Image or resource content types - Out of scope for initial implementation

**Implementation Notes**:
- The `content` field is an array that can contain multiple content blocks
- Each text content block has `type: "text"` and `text: string`
- Optional `annotations` field for metadata (not required for initial implementation)
- `isError: true` for error responses

---

### 2. Side Drawer UI Pattern

**Question**: What existing UI patterns can be reused for the step type selection drawer?

**Decision**: Create a new `StepTypeDrawer` component following the existing modal patterns in the codebase

**Rationale**: The codebase uses fixed-position overlays for modals (e.g., `MockDataModal`, `CreateFlowModal`). A right-side drawer can follow the same pattern with:
- Fixed positioning (`fixed right-0 top-0 h-full`)
- Backdrop overlay with click-to-close
- Slide-in animation using Tailwind transitions

**Alternatives Considered**:
- Inline dropdown menu - Rejected because it doesn't provide enough space for option descriptions
- Full-screen modal - Rejected because it's too disruptive for a simple 2-option selection

**Implementation Notes**:
- Use `lucide-react` icons for View (LayoutGrid) and Return value (FileText or Code)
- Include brief descriptions for each option
- Close drawer after selection

---

### 3. Entity Design: Separate Entity vs Flow Column

**Question**: Should return value be a separate entity or a column on the Flow entity?

**Decision**: Create a separate `ReturnValueEntity` with a one-to-many relationship to Flow

**Rationale**:
- **Extensibility**: Return values may grow in complexity (templates, variables, conditional logic)
- **Multiple return values**: A flow can have zero or more return values, each as a separate content block
- **Follows existing patterns**: Mirrors the View entity pattern with `order` field for sequencing
- **Future-proofing**: Adding fields to an entity is easier than migrating a column to a table

**Alternatives Considered**:
- Add `returnValue` column to Flow entity - Rejected because:
  - Limits to single return value per flow
  - Harder to extend with additional fields later
  - Doesn't follow the View entity pattern
- Polymorphic "Step" entity containing both views and return values - Rejected as it would require significant refactoring

**Implementation Notes**:
- Create `ReturnValueEntity` with fields: id, flowId, text, order, createdAt, updatedAt
- Flow has return values when: `flow.returnValues?.length > 0`
- Flow has views when: `flow.views?.length > 0`
- Mutual exclusivity enforced in both ViewService and ReturnValueService
- All return values returned as separate text content items in MCP response

---

### 4. Flow Diagram Node Rendering

**Question**: How should the return value step be displayed in the React Flow diagram?

**Decision**: Create a `ReturnValueNode` component following the existing `ViewNode` pattern

**Rationale**: The flow diagram uses `@xyflow/react` with custom node types. The existing patterns show:
- Node components receive `data` prop with flow/view information
- Nodes are positioned using handles for connections
- Edit actions open modals or editors

**Alternatives Considered**:
- Inline text editing in the node - Rejected because it would be cramped and inconsistent with view editing
- Separate page for return value editing - Rejected as overly complex for text editing

**Implementation Notes**:
- Show a compact preview of the return value text (truncated)
- Click to open full text editor
- Use distinct styling to differentiate from ViewNode (e.g., different icon, border color)
- Position after UserIntentNode in the diagram

---

### 5. MCP Tool Execution Integration

**Question**: How should the McpToolService handle flows with return values vs views?

**Decision**: Check for return values first, then fall back to view rendering

**Rationale**: The existing `executeTool` method in `mcp.tool.ts` retrieves the primary view and generates a response. For return values:
- If `flow.returnValues` exists and has items, return all as text content array
- If no return values, continue with existing view-based response

**Alternatives Considered**:
- Separate endpoint for return value tools - Rejected as it breaks the unified tool interface
- Flag on the tool to indicate return type - Rejected as unnecessary complexity

**Implementation Notes**:
- Modify `McpToolService.executeTool()` to check `flow.returnValues.length > 0` first
- Map all return values to text content items, preserving order
- Return MCP text content format without `structuredContent` or `_meta` widget data
- No UI widget generation needed for return value flows

---

### 6. Text Editor Component

**Question**: What text editor component should be used for editing return values?

**Decision**: Use a standard `<textarea>` with Tailwind styling

**Rationale**:
- The return value is plain text, not code
- No syntax highlighting needed
- Keeps dependencies minimal
- Consistent with existing text inputs in the application

**Alternatives Considered**:
- Monaco Editor - Rejected as overkill for plain text
- CodeMirror - Rejected as unnecessary complexity
- Markdown editor - Rejected as return values are plain text

**Implementation Notes**:
- Full-height textarea with scrolling for long content
- Character count display (optional)
- Placeholder text explaining the purpose

---

## Summary

All research questions have been resolved. The implementation approach:

1. **Data Model**: Create `ReturnValueEntity` with one-to-many relationship to Flow
2. **Backend**:
   - Create ReturnValueService with CRUD operations
   - Create ReturnValueController with REST endpoints
   - Modify FlowService to load return values
   - Modify ViewService to enforce mutual exclusivity
   - Modify McpToolService for execution
3. **Frontend**:
   - Rename `AddViewNode` to `AddStepNode`, update text
   - Create `StepTypeDrawer` for View/Return value selection
   - Create `ReturnValueNode` for diagram display
   - Create `ReturnValueEditor` with textarea
   - Add API client methods for return value CRUD
4. **Shared Types**: Create `ReturnValue` type, add `returnValues` to Flow type

No external dependencies need to be added. All functionality can be built using existing packages.
