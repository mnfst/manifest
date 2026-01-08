# Research: UI Node Edit Modal Consolidation

**Feature Branch**: `001-ui-edit-modal-merge`
**Date**: 2026-01-08

## Research Questions Addressed

### 1. Component Appearance Options Schema

**Question**: What appearance options exist for UI components and how should they be defined?

**Decision**: Define a typed appearance options schema for each component type, based on the Manifest UI registry component interfaces.

**Rationale**: The Manifest UI components have well-defined prop interfaces (documented in specs/006-manifest-ui-blocks). These props fall into distinct categories:
- **Layout variants**: How content is arranged (list, grid, carousel)
- **Display toggles**: Show/hide specific elements (showAuthor, showCategory)
- **Size/count**: Numeric settings (columns)
- **Selection modes**: Single/multi/none selection

**Alternatives Considered**:
- Generic key-value config without types - rejected because it prevents form generation
- Fetching schemas dynamically from registry - rejected because the registry.json doesn't include prop definitions

### 2. Appearance Options by Component Type

**Decision**: Support the following appearance options based on Manifest UI component interfaces:

| Component | Option | Type | Values | Default |
|-----------|--------|------|--------|---------|
| **PostList** | variant | enum | 'list', 'grid', 'carousel' | 'list' |
| | columns | enum | 2, 3 | 3 |
| | showAuthor | boolean | true/false | true |
| | showCategory | boolean | true/false | true |
| **ProductList** | variant | enum | 'list', 'grid', 'carousel', 'picker' | 'grid' |
| | columns | enum | 2, 3 | 3 |
| **OptionList** | selectable | enum | 'single', 'multiple' | 'single' |
| **TagSelect** | multiSelect | boolean | true/false | false |
| **ProgressSteps** | layout | enum | 'horizontal', 'vertical' | 'horizontal' |
| **StatusBadge** | status | enum | 'success', 'pending', 'processing', 'error', 'shipped', 'delivered' | 'pending' |
| **PostCard** | variant | enum | 'default', 'compact', 'horizontal', 'covered' | 'default' |
| **Table** | selectable | enum | 'none', 'single', 'multi' | 'none' |
| | compact | boolean | true/false | false |
| | stickyHeader | boolean | true/false | false |
| **Stats** | (none) | - | - | - |

**Rationale**: Based on actual component prop definitions from specs/006-manifest-ui-blocks/research.md and specs/006-manifest-ui-blocks/data-model.md.

### 3. Storage Strategy for Appearance Config

**Question**: How should appearance configuration be stored in the node parameters?

**Decision**: Add an `appearanceConfig` field to node parameters alongside existing `customCode`.

```typescript
interface UINodeParameters {
  customCode?: string;           // Existing field
  appearanceConfig?: Record<string, unknown>;  // New field - key-value pairs
}
```

**Rationale**:
- Keeps appearance separate from code for clear separation of concerns
- Generic Record type allows flexibility for different component types
- Can be merged with component defaults when generating preview

**Alternatives Considered**:
- Embedding in customCode as comments - rejected, brittle and hard to parse
- Separate column in entity - rejected, overkill for JSON-stored nodes

### 4. Form Control Mapping

**Question**: How should the Appearance tab render form controls?

**Decision**: Map types to controls as follows:

| Schema Type | Form Control | Implementation |
|-------------|--------------|----------------|
| Enum (string union) | Dropdown/Select | Options from enum values |
| Enum (number union) | Dropdown/Select | Options from enum values |
| Boolean | Toggle/Switch | On/off states |
| String | Text Input | Free text |
| Number | Number Input | Numeric spinner |

**Rationale**: Standard form patterns that users are familiar with. Each type maps to a single control type for consistency.

### 5. Layout Template Removal Strategy

**Question**: How should the layoutTemplate field be removed safely?

**Decision**:
1. Remove from DTOs and frontend code
2. Keep backward compatibility in entity (ignore field if present in existing data)
3. No data migration needed - existing nodes continue to work

**Rationale**: Since layoutTemplate only had one value ('stat-card'), it provides no actual configuration value. Removing it simplifies the model without losing functionality.

### 6. Tab Structure for Unified Editor

**Question**: What should the tab structure be?

**Decision**: Four tabs in this order:
1. **General** - Node name and schema configuration
2. **Appearance** - Visual options form
3. **Code** - Custom TSX code editor (existing CodeEditor component)
4. **Preview** - Live component preview (existing ComponentPreview)

**Rationale**:
- General first as it's the most commonly edited
- Appearance before Code because most users will use form-based config
- Preview last as it shows the result of all other tabs

### 7. Node Addition Behavior Change

**Question**: Should UI nodes skip the editor when added?

**Decision**: Yes, when a UI node is added from the library:
1. Create node with default values
2. Add to canvas at calculated position
3. Do NOT open the editor automatically

Users can edit via context menu or double-click.

**Rationale**: The current behavior (auto-opening editor) interrupts the user's flow when building out the canvas structure. Users should control when to dive into configuration.

## Best Practices Identified

### React Tab Components
- Use controlled tab state to preserve unsaved changes across tab switches
- Store form state in parent component, not individual tabs
- Use React Context or lifted state for cross-tab data sharing

### Form Generation from Schema
- Define schemas as TypeScript types for compile-time safety
- Use discriminated unions for field type definitions
- Provide sensible defaults for all optional fields

### Real-time Preview Updates
- Debounce appearance changes before updating preview
- Use useMemo for expensive preview computations
- Keep preview component pure - only depends on props

## Files to Modify

### Frontend
- `packages/frontend/src/components/editor/InterfaceEditor.tsx` - Add tabs, General and Appearance
- `packages/frontend/src/components/flow/ViewNodeDropdown.tsx` - Rename "Edit Code" to "Edit"
- `packages/frontend/src/components/flow/NodeEditModal.tsx` - Remove StatCard handling
- `packages/frontend/src/pages/FlowDetail.tsx` - Remove auto-open editor on node add

### Shared Package
- `packages/shared/src/types/node.ts` - Remove layoutTemplate from StatCardNodeParameters, add appearanceConfig
- `packages/shared/src/types/app.ts` - Remove LAYOUT_REGISTRY or simplify
- `packages/shared/src/types/appearance.ts` (new) - Define appearance option schemas

### Backend
- `packages/backend/src/node/node.service.ts` - No validation changes needed (generic parameters)
- May need DTO updates if layoutTemplate was explicitly typed

## Out of Scope

- Adding new component types (only supporting existing UI node type)
- Dynamic schema fetching from Manifest UI registry
- Appearance options for non-UI node types
- Custom appearance option types beyond enum/boolean/string/number
