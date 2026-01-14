# Quickstart: App Theme Editor

**Feature**: 001-app-theme-editor
**Date**: 2026-01-13

## Prerequisites

- Node.js >=18.0.0
- pnpm 9.x
- Access to the monorepo

## Setup

### 1. Install New Dependencies

```bash
# From repository root
pnpm add react-colorful @codemirror/lang-css -F frontend
```

### 2. Verify Existing Infrastructure

The following should already exist:
- `packages/shared/src/types/theme.ts` - ThemeVariables type
- `packages/backend/src/app/app.entity.ts` - AppEntity with themeVariables column
- `packages/frontend/src/components/common/CodeEditor.tsx` - CodeMirror wrapper

### 3. Start Development Servers

```bash
# From repository root
pnpm dev
```

Or use the serve script for testing:
```bash
.specify/scripts/bash/serve-app.sh
```

## File Structure to Create

```
packages/frontend/src/
├── components/
│   └── theme-editor/
│       ├── index.ts                    # Barrel export
│       ├── ThemeEditor.tsx             # Main container component
│       ├── ColorPickerControl.tsx      # Individual color picker
│       ├── VariableControlGroup.tsx    # Grouped controls section
│       ├── ThemeCodeEditor.tsx         # CodeMirror CSS editor
│       ├── ThemePreview.tsx            # Preview component
│       ├── types.ts                    # Local type definitions
│       └── hooks/
│           └── useThemeEditor.ts       # State management hook
└── lib/
    └── hsl-utils.ts                    # HSL conversion utilities
```

## Implementation Order

1. **HSL Utilities** (`lib/hsl-utils.ts`)
   - parseHslString()
   - formatHslObject()
   - validateHslString()
   - validateRadius()

2. **Types** (`theme-editor/types.ts`)
   - ThemeVariableGroup
   - THEME_VARIABLE_GROUPS constant

3. **State Hook** (`hooks/useThemeEditor.ts`)
   - ThemeEditorState management
   - Dirty state tracking
   - Validation logic

4. **Color Picker** (`ColorPickerControl.tsx`)
   - react-colorful integration
   - HSL string conversion

5. **Variable Groups** (`VariableControlGroup.tsx`)
   - Organized control sections

6. **Code Editor** (`ThemeCodeEditor.tsx`)
   - CodeMirror with CSS language
   - Bidirectional sync

7. **Preview** (`ThemePreview.tsx`)
   - Sample components with ThemeProvider
   - Modular interface

8. **Main Editor** (`ThemeEditor.tsx`)
   - Compose all sub-components
   - Save/Reset buttons
   - Navigation warning

9. **Integration** (`pages/AppDetail.tsx`)
   - Add Theme tab
   - Load/save via API

## Key Patterns

### HSL Conversion

```typescript
// From ThemeVariables string to react-colorful object
const hslString = "--primary: 222.2 47.4% 11.2%";
const hslObject = parseHslString(hslString);
// { h: 222.2, s: 47.4, l: 11.2 }

// From react-colorful object to ThemeVariables string
const formatted = formatHslObject(hslObject);
// "222.2 47.4% 11.2%"
```

### Bidirectional Sync

```typescript
// Single source of truth
const [variables, setVariables] = useState<ThemeVariables>(initialVariables);

// Visual picker updates state
const handleColorChange = (key: string, hsl: HslObject) => {
  setVariables(prev => ({
    ...prev,
    [key]: formatHslObject(hsl)
  }));
};

// Code editor updates state
const handleCodeChange = (code: string) => {
  const parsed = parseCssVariables(code);
  setVariables(parsed);
};
```

### Preview Modularity

```typescript
interface ThemePreviewProps {
  themeVariables: ThemeVariables;
}

// Default implementation
function DefaultThemePreview({ themeVariables }: ThemePreviewProps) {
  return (
    <ThemeProvider themeVariables={themeVariables}>
      {/* Sample components */}
    </ThemeProvider>
  );
}

// Theme editor accepts custom preview
<ThemeEditor
  PreviewComponent={CustomPreview}  // Optional override
/>
```

## Testing

### Manual Testing Checklist

1. Open an app detail page
2. Click "Theme" tab
3. Change a color with the picker → verify preview updates
4. Edit in code editor → verify picker updates
5. Click Save → verify persists after refresh
6. Make changes, then navigate away → verify warning appears
7. Click Reset to Default → verify confirmation dialog

### API Testing

```bash
# Get current theme
curl http://localhost:3847/api/apps/{appId}

# Update theme
curl -X PATCH http://localhost:3847/api/apps/{appId} \
  -H "Content-Type: application/json" \
  -d '{"themeVariables": {"--primary": "200 50% 50%"}}'
```

## Common Issues

### Color picker shows wrong color
- Ensure HSL parsing handles decimal values
- Check that percentages include the `%` symbol

### Code editor doesn't sync
- Verify CSS parsing regex matches the format
- Check for trailing semicolons/newlines

### Preview doesn't update
- Ensure ThemeProvider receives new props
- Check CSS variable naming matches Tailwind classes

## Reference Links

- [react-colorful docs](https://github.com/omgovich/react-colorful)
- [@codemirror/lang-css](https://github.com/codemirror/lang-css)
- [shadcn/ui theming](https://ui.shadcn.com/docs/theming)
