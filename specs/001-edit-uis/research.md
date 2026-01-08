# Research: Editable UI Interfaces

**Branch**: `001-edit-uis` | **Date**: 2026-01-07

## Research Questions

1. What code editor library should be used?
2. How to create a custom theme matching Manifest VS Code theme?
3. How to safely preview/render user-edited React components?
4. How to validate TSX code for syntax errors client-side?
5. What format should the component code use?

---

## 1. Code Editor Library

### Decision: @uiw/react-codemirror (CodeMirror 6)

### Rationale
- **React-native integration**: Provides React hooks (`useCodeMirror`) and component API designed for React 18
- **TypeScript support**: Written in TypeScript with full type definitions
- **Modular architecture**: Only import needed extensions (syntax highlighting, linting, line numbers)
- **Active maintenance**: Regular updates, large community (GitHub uiwjs/react-codemirror)
- **Bundle size efficiency**: Can selectively import only required `@codemirror/*` packages
- **Performance**: Designed for large documents, efficient re-rendering with memoization patterns

### Alternatives Considered

| Alternative | Rejected Because |
|------------|------------------|
| Monaco Editor | Heavyweight (~2MB), VS Code complexity overkill for simple editing |
| Ace Editor | Legacy architecture, less modern React integration |
| CodeMirror 5 | Deprecated in favor of CodeMirror 6 |
| Native textarea | No syntax highlighting, no line numbers, poor UX |

### Implementation Notes
- Use `React.useMemo` for extensions to prevent re-renders
- Define theme and extensions outside component for performance
- Leverage `@codemirror/lang-javascript` with `{ typescript: true, jsx: true }` for TSX support

### Dependencies to Add
```json
{
  "@uiw/react-codemirror": "^4.x",
  "@codemirror/lang-javascript": "^6.x",
  "@codemirror/lint": "^6.x",
  "@lezer/highlight": "^1.x"
}
```

---

## 2. Custom Theme (Manifest)

### Decision: Create custom EditorView.theme() + HighlightStyle

### Rationale
CodeMirror 6 separates UI theming (EditorView.theme) from syntax highlighting (HighlightStyle). This matches VS Code's theme structure and allows precise color mapping from the Manifest theme.

### Theme Colors (from mnfst/vscode-theme-manifest)

| Element | Hex Color |
|---------|-----------|
| Editor Background | `#1c1c24` |
| Editor Foreground | `#f2c79c` |
| Cursor | `#ddbb88` |
| Selection | `#2430f0` |
| Line Numbers | `#6688cc` |
| Active Line Number | `#d8ddfc` |
| Comments | `#6688cc` |
| Strings | `#f7d7bc` |
| Numbers | `#ff9e9c` |
| Keywords | `#F2C79C` |
| Variables | `#a8efe0` |
| Functions | `#2be1b7` |
| Classes/Types | `#82F0DD` |

### Implementation Structure
```typescript
// manifestTheme.ts
import { EditorView } from '@codemirror/view'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'

export const manifestEditorTheme = EditorView.theme({
  '&': { backgroundColor: '#1c1c24', color: '#f2c79c' },
  '.cm-content': { caretColor: '#ddbb88' },
  '.cm-cursor': { borderLeftColor: '#ddbb88' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': { backgroundColor: '#2430f0' },
  '.cm-gutters': { backgroundColor: '#1c1c24', color: '#6688cc', border: 'none' },
  '.cm-activeLineGutter': { color: '#d8ddfc' },
  '.cm-activeLine': { backgroundColor: 'rgba(36, 48, 240, 0.1)' },
})

export const manifestHighlightStyle = HighlightStyle.define([
  { tag: tags.comment, color: '#6688cc', fontStyle: 'italic' },
  { tag: tags.string, color: '#f7d7bc' },
  { tag: tags.number, color: '#ff9e9c' },
  { tag: tags.keyword, color: '#F2C79C' },
  { tag: tags.variableName, color: '#a8efe0' },
  { tag: tags.function(tags.variableName), color: '#2be1b7' },
  { tag: tags.typeName, color: '#82F0DD' },
  { tag: tags.className, color: '#82F0DD' },
  { tag: tags.tagName, color: '#2be1b7' },
  { tag: tags.attributeName, color: '#a8efe0' },
  { tag: tags.operator, color: '#f2c79c' },
  { tag: tags.punctuation, color: '#f2c79c' },
])

export const manifestTheme = [manifestEditorTheme, syntaxHighlighting(manifestHighlightStyle)]
```

---

## 3. Component Preview Strategy

### Decision: Direct React rendering with Error Boundary (no iframe sandbox)

### Rationale
- **Security context**: This is a POC with trusted users editing their own components
- **Simplicity**: Iframe sandboxing adds complexity (postMessage, separate bundle, communication)
- **Performance**: Direct rendering is faster than iframe + bundling
- **Integration**: Components can use existing UI library imports and Tailwind classes

### Alternatives Considered

| Alternative | Rejected Because |
|------------|------------------|
| Sandpack (CodeSandbox bundler) | Overkill for POC, complex setup, large bundle |
| Iframe with srcdoc | Isolation not needed for trusted code, complex state sync |
| Web Workers | Cannot render React, only for computation |

### Implementation Approach
1. Parse TSX code into a function component using dynamic import or eval
2. Wrap rendering in React Error Boundary to catch runtime errors
3. Provide sample data props to the component
4. Use try/catch for graceful failure display

### Security Note
For production, consider iframe sandboxing. POC phase accepts this trade-off per constitution.

---

## 4. Code Validation Strategy

### Decision: TypeScript compiler in browser via @babel/parser + custom linting

### Rationale
- **Syntax validation**: Babel parser can detect JSX/TSX syntax errors without full TypeScript checker
- **Client-side**: No server round-trips, instant feedback
- **Lightweight**: Babel parser is smaller than full TypeScript compiler (~300KB vs ~10MB)
- **Sufficient for POC**: Catches syntax errors; type errors are less critical for component editing

### Validation Levels

| Level | Tool | What It Catches |
|-------|------|-----------------|
| Syntax | @babel/parser | Missing brackets, invalid JSX, malformed code |
| Lint | @codemirror/lint | Real-time inline error highlighting |
| Runtime | Error Boundary | Reference errors, missing imports, render failures |

### Implementation Notes
- Use `@babel/parser` with `jsx`, `typescript` plugins
- Wrap parse in try/catch to extract error location (line, column)
- Display errors in CodeMirror gutter via `@codemirror/lint`
- Block save if parse fails

### Dependencies to Add
```json
{
  "@babel/parser": "^7.x"
}
```

---

## 5. Component Code Format

### Decision: Export React functional component as default

### Rationale
The existing UI components (Table, BlogPostList) are already React functional components. Maintaining the same format ensures consistency and allows direct rendering.

### Template Code Format
```tsx
// Default code for 'table' template
import { Table } from '@/components/ui/table'

export default function CustomTable({ data }) {
  return (
    <Table
      columns={[
        { header: 'Name', accessor: 'name' },
        { header: 'Value', accessor: 'value' },
      ]}
      data={data}
      selectable="none"
    />
  )
}
```

```tsx
// Default code for 'post-list' template
import { BlogPostList } from '@/components/ui/blog-post-list'

export default function CustomBlogPostList({ posts }) {
  return (
    <BlogPostList
      posts={posts}
      variant="list"
      showAuthor={true}
      showCategory={true}
    />
  )
}
```

### Sample Data for Preview
Each template will have corresponding sample data defined in the template registry:
- Table: Array of objects with common fields
- Post-list: Array of BlogPost objects

---

## Summary

| Question | Decision |
|----------|----------|
| Code editor | @uiw/react-codemirror (CodeMirror 6) |
| Custom theme | EditorView.theme() + HighlightStyle with Manifest colors |
| Preview approach | Direct React render with Error Boundary |
| Code validation | @babel/parser for syntax + @codemirror/lint for inline errors |
| Code format | Default export functional component with props |

## New Dependencies

```json
{
  "@uiw/react-codemirror": "^4.23.0",
  "@codemirror/lang-javascript": "^6.2.0",
  "@codemirror/lint": "^6.8.0",
  "@lezer/highlight": "^1.2.0",
  "@babel/parser": "^7.24.0"
}
```
