# Research: App Theme Editor

**Feature**: 001-app-theme-editor
**Date**: 2026-01-13
**Status**: Complete

## Research Tasks

### 1. Color Picker Library Selection

**Decision**: react-colorful

**Rationale**:
- Extremely lightweight at 2.8kb minified (vs 13kb+ for alternatives)
- Zero dependencies - doesn't add transitive dependency bloat
- Native HSL support via `HslColorPicker` component - matches our ThemeVariables format
- Modern React hooks-based API with controlled component pattern
- Accessible (keyboard navigation, ARIA labels)
- Customizable with CSS - can match existing shadcn styling
- Active maintenance and wide adoption

**Alternatives Considered**:

| Library | Size | HSL Support | Why Rejected |
|---------|------|-------------|--------------|
| react-color | 13kb+ | Converts | Larger bundle, older API patterns |
| @radix-ui/colors | N/A | No picker | Color scales only, not a picker |
| Native HTML input[type=color] | 0kb | No | No HSL support, inconsistent browser UI |
| rc-color-picker | 20kb+ | Limited | Heavy, requires additional CSS |

**Integration Pattern**:
```tsx
import { HslColorPicker } from 'react-colorful';

// Our HSL string: "222.2 47.4% 11.2%"
// react-colorful HSL object: { h: 222.2, s: 47.4, l: 11.2 }
// Need utility functions to convert between formats
```

---

### 2. CodeMirror Configuration for CSS Editing

**Decision**: Extend existing @uiw/react-codemirror setup with CSS language support

**Rationale**:
- @uiw/react-codemirror 4.25.4 already installed and configured
- Project has existing CodeEditor components with established patterns
- @codemirror/lang-css available for CSS syntax highlighting
- Can reuse manifestTheme or create theme-editor-specific light theme

**Implementation Approach**:
```tsx
import { css } from '@codemirror/lang-css';
import CodeMirror from '@uiw/react-codemirror';

// Theme variables displayed as CSS custom properties:
// :root {
//   --primary: 222.2 47.4% 11.2%;
//   --primary-foreground: 210 40% 98%;
// }
```

**Extensions to Include**:
- CSS language support (@codemirror/lang-css)
- Line numbers (existing)
- Bracket matching (existing)
- Light theme for visibility of color previews

**Alternatives Considered**:

| Approach | Why Rejected |
|----------|--------------|
| Monaco Editor | Much heavier, would add new dependency |
| Ace Editor | Older, not integrated in project |
| Plain textarea | No syntax highlighting, poor UX |
| JSON editing | Less intuitive than CSS format |

---

### 3. HSL Format Handling

**Decision**: Create utility functions for HSL string ↔ object conversion

**Rationale**:
- ThemeVariables uses space-separated HSL strings: `"222.2 47.4% 11.2%"`
- react-colorful uses HSL objects: `{ h: 222.2, s: 47.4, l: 11.2 }`
- CSS custom properties expect the string format
- Need bidirectional conversion for picker ↔ state sync

**Implementation**:
```typescript
// packages/frontend/src/lib/hsl-utils.ts

export interface HslObject {
  h: number;  // 0-360
  s: number;  // 0-100
  l: number;  // 0-100
}

// "222.2 47.4% 11.2%" → { h: 222.2, s: 47.4, l: 11.2 }
export function parseHslString(hslString: string): HslObject { ... }

// { h: 222.2, s: 47.4, l: 11.2 } → "222.2 47.4% 11.2%"
export function formatHslObject(hsl: HslObject): string { ... }

// Validation
export function isValidHslString(value: string): boolean { ... }
```

---

### 4. State Management Architecture

**Decision**: Single source of truth with useThemeEditor custom hook

**Rationale**:
- Need bidirectional sync between visual controls and code editor (FR-005)
- React state with immediate updates for 200ms preview requirement
- No external state library needed - local component state sufficient
- Dirty state tracking for unsaved changes indicator (FR-012)

**State Shape**:
```typescript
interface ThemeEditorState {
  // Current editing values (may differ from saved)
  variables: ThemeVariables;

  // Original saved values for comparison
  savedVariables: ThemeVariables;

  // Derived state
  isDirty: boolean;

  // Validation
  errors: Record<string, string>;

  // UI state
  isSaving: boolean;
}
```

**Update Flow**:
1. Visual picker changes → update `variables` state → code editor re-renders
2. Code editor changes → parse CSS → update `variables` state → pickers re-render
3. Both paths update preview immediately via CSS variable injection

---

### 5. Preview Component Architecture

**Decision**: Render props pattern with ThemeProvider isolation

**Rationale**:
- FR-007 requires preview to be replaceable without modifying editor
- Render props allow injecting custom preview components
- ThemeProvider isolation ensures preview doesn't affect main app styles
- SC-005 metric: developer can replace in under 30 minutes

**Interface**:
```typescript
interface ThemePreviewProps {
  themeVariables: ThemeVariables;
}

// Default preview component
function DefaultThemePreview({ themeVariables }: ThemePreviewProps) {
  return (
    <ThemeProvider themeVariables={themeVariables}>
      <div className="preview-container">
        <Button>Primary Button</Button>
        <Input placeholder="Input field" />
        {/* ... more shadcn components */}
      </div>
    </ThemeProvider>
  );
}

// Theme editor accepts custom preview
interface ThemeEditorProps {
  PreviewComponent?: React.ComponentType<ThemePreviewProps>;
}
```

---

### 6. Unsaved Changes Warning (FR-011)

**Decision**: Use beforeunload event + React Router prompt

**Rationale**:
- Browser navigation: `beforeunload` event
- React Router navigation: `useBlocker` hook (react-router-dom v7)
- Consistent with web application patterns
- User expectation for form-like editors

**Implementation**:
```typescript
// Browser tab close/refresh
useEffect(() => {
  if (isDirty) {
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      return '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }
}, [isDirty]);

// React Router navigation
const blocker = useBlocker(isDirty);
// Show confirmation dialog when blocker.state === 'blocked'
```

---

### 7. Variable Grouping for UI

**Decision**: Group related variables for better UX

**Groups**:
1. **Primary Colors**: primary, primary-foreground
2. **Background Colors**: background, foreground
3. **Muted Colors**: muted, muted-foreground
4. **Accent Colors**: accent, accent-foreground
5. **Card Colors**: card, card-foreground
6. **Popover Colors**: popover, popover-foreground
7. **Secondary Colors**: secondary, secondary-foreground
8. **Border & Input**: border, input, ring
9. **Destructive**: destructive, destructive-foreground
10. **Spacing**: radius

**Rationale**:
- Mirrors shadcn theme organization
- Foreground colors shown next to their backgrounds
- Easier to maintain consistent color pairs
- Matches mental model of theming

---

## Dependencies to Add

```json
{
  "dependencies": {
    "react-colorful": "^5.6.1"
  },
  "devDependencies": {
    "@codemirror/lang-css": "^6.3.1"
  }
}
```

**Installation**: `pnpm add react-colorful @codemirror/lang-css -F frontend`

---

## Open Questions Resolved

| Question | Resolution |
|----------|------------|
| Color picker library? | react-colorful - lightweight, HSL native |
| State management? | Local React state with custom hook |
| CSS editing format? | CodeMirror with CSS language |
| Preview isolation? | ThemeProvider with inline styles |
| Navigation warning? | beforeunload + React Router useBlocker |
