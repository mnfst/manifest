# Quickstart: Editable UI Interfaces

**Branch**: `001-edit-uis` | **Date**: 2026-01-07

## Prerequisites

- Node.js 18+
- pnpm 9.x
- Project dependencies installed (`pnpm install`)

## New Dependencies

Install the following packages in `packages/frontend`:

```bash
cd packages/frontend
pnpm add @uiw/react-codemirror @codemirror/lang-javascript @codemirror/lint @lezer/highlight @babel/parser
```

## Key Files to Create/Modify

### New Files

| File | Purpose |
|------|---------|
| `packages/frontend/src/components/editor/InterfaceEditor.tsx` | Main full-screen editor view |
| `packages/frontend/src/components/editor/CodeEditor.tsx` | CodeMirror wrapper component |
| `packages/frontend/src/components/editor/ComponentPreview.tsx` | Live preview with sample data |
| `packages/frontend/src/components/editor/manifestTheme.ts` | Manifest color theme for CodeMirror |
| `packages/frontend/src/lib/codeValidator.ts` | TSX syntax validation utilities |
| `packages/frontend/src/types/editor.ts` | Editor-related TypeScript types |
| `packages/shared/src/types/validation.ts` | ValidationError/ValidationResult types |
| `packages/shared/src/types/templates.ts` | Default template code registry |

### Modified Files

| File | Changes |
|------|---------|
| `packages/shared/src/types/node.ts` | Add `customCode` to InterfaceNodeParameters |
| `packages/shared/src/types/app.ts` | Add `defaultCode`, `sampleData` to LayoutTemplateConfig |
| `packages/frontend/src/components/flow/ViewNode.tsx` | Add Edit button to Interface nodes |
| `packages/frontend/src/pages/FlowDetail.tsx` | Conditionally render editor vs canvas |
| `packages/frontend/src/lib/api.ts` | Add template default code endpoint |
| `packages/backend/src/node/node.controller.ts` | Add template endpoint |

## Implementation Order

### Phase 1: Foundation
1. Add new dependencies
2. Create shared types (validation.ts, templates.ts)
3. Extend InterfaceNodeParameters with customCode
4. Create manifestTheme.ts with Manifest colors

### Phase 2: Code Editor
5. Create CodeEditor.tsx (CodeMirror wrapper)
6. Create codeValidator.ts (Babel parser integration)
7. Integrate lint extension with validation

### Phase 3: Preview
8. Create ComponentPreview.tsx
9. Add sample data to template registry
10. Implement error boundary for render failures

### Phase 4: Full Editor View
11. Create InterfaceEditor.tsx (combines code + preview)
12. Add view toggle (preview/code)
13. Implement save with validation
14. Add unsaved changes confirmation

### Phase 5: Integration
15. Add Edit button to ViewNode.tsx
16. Modify FlowDetail.tsx for editor routing
17. Add template default code endpoint
18. Update API client

## Quick Test

After implementation, verify with these steps:

1. Start the development server:
   ```bash
   pnpm dev
   ```

2. Navigate to a flow with an Interface node

3. Click the "Edit" button on the Interface node

4. Verify:
   - Full-screen editor opens with Manifest theme
   - Default code is displayed
   - Toggle between preview and code works
   - Making changes marks as "unsaved"
   - Syntax errors show inline
   - Cannot save with errors
   - Successful save returns to canvas

## Troubleshooting

### CodeMirror not rendering
- Ensure `@uiw/react-codemirror` is installed
- Check that extensions are memoized (not recreated on each render)

### Theme colors incorrect
- Verify manifestTheme.ts exports both EditorView.theme and HighlightStyle
- Ensure `syntaxHighlighting(manifestHighlightStyle)` is in extensions

### Validation not working
- Check @babel/parser is installed
- Verify JSX and TypeScript plugins are enabled in parser options

### Preview shows error
- Check sample data matches expected props
- Verify Error Boundary is wrapping the preview
- Look for console errors for specific failure

## Architecture Notes

```
FlowDetail.tsx
├── editingNodeId state (null = show canvas, string = show editor)
├── FlowDiagram.tsx (when editingNodeId is null)
│   └── ViewNode.tsx
│       └── Edit button → sets editingNodeId
└── InterfaceEditor.tsx (when editingNodeId is set)
    ├── Header (node name, close, save buttons)
    ├── Toggle (preview | code)
    └── Main Area
        ├── ComponentPreview.tsx (when preview mode)
        └── CodeEditor.tsx (when code mode)
```
