# Research: Manifest UI Blocks Integration

**Feature**: 006-manifest-ui-blocks
**Date**: 2025-12-27
**Status**: Complete

## Research Tasks

### 1. Manifest UI Registry Structure

**Task**: Understand how to install and use Manifest UI components

**Findings**:
- Registry URL: `https://ui.manifest.build/r/registry.json`
- Component JSON format: `https://ui.manifest.build/r/{component-name}.json`
- Built on shadcn/ui - uses same CLI installation pattern
- Components are self-contained with embedded source code in JSON

**Decision**: Use shadcn CLI with custom registry URL to install components
**Rationale**: Consistent with shadcn/ui patterns, allows local customization
**Alternatives Considered**:
- Manual copy-paste: Rejected - harder to update
- npm package: Not available - Manifest uses registry approach

### 2. Manifest Table Component Interface

**Task**: Document the exact TypeScript interface for Manifest Table

**Findings**:
From `https://ui.manifest.build/r/table.json`:

```typescript
export interface TableColumn<T = Record<string, unknown>> {
  header: string
  accessor: keyof T | string
  sortable?: boolean
  width?: string
  align?: 'left' | 'center' | 'right'
  render?: (value: unknown, row: T, index: number) => React.ReactNode
}

export interface TableProps<T = Record<string, unknown>> {
  columns?: TableColumn<T>[]
  data?: T[]
  selectable?: 'none' | 'single' | 'multi'
  onSelectionChange?: (selectedRows: T[]) => void
  loading?: boolean
  emptyMessage?: string
  stickyHeader?: boolean
  compact?: boolean
  selectedRows?: T[]
  showActions?: boolean
  onDownload?: (selectedRows: T[]) => void
  onSend?: (selectedRows: T[]) => void
}
```

**Decision**: Keep internal TableMockData format, create mapping function to Manifest props
**Rationale**: Backward compatibility, single source of truth in shared types
**Alternatives Considered**:
- Replace internal types entirely: Rejected - breaks existing AI prompts and stored data

### 3. Manifest BlogPostList Component Interface

**Task**: Document the exact TypeScript interface for Manifest BlogPostList

**Findings**:
From `https://ui.manifest.build/r/blog-post-list.json`:

```typescript
export interface BlogPost {
  id: string
  title: string
  excerpt: string
  coverImage?: string
  author: {
    name: string
    avatar?: string
  }
  publishedAt: string
  readTime?: string
  tags?: string[]
  category?: string
}

export interface BlogPostListProps {
  posts?: BlogPost[]
  variant?: 'list' | 'grid' | 'carousel'
  columns?: 2 | 3
  showAuthor?: boolean
  showCategory?: boolean
  onReadMore?: (post: BlogPost) => void
}
```

**Decision**: Map internal PostItem to Manifest BlogPost, transform `author: string` to `author: { name: string }`
**Rationale**: Minimal internal changes, clear mapping layer
**Alternatives Considered**:
- Change internal PostItem to match BlogPost: Rejected - requires migration

### 4. Current Internal Data Structures

**Task**: Analyze current mock data types for mapping requirements

**Findings**:
From `packages/shared/src/types/mock-data.ts`:

```typescript
// Current TableColumn - needs mapping
interface TableColumn {
  key: string           // → accessor
  header: string        // → header (same)
  type: 'text' | 'number' | 'date' | 'badge' | 'action'  // → render function
}

// Current PostItem - needs mapping
interface PostItem {
  id: string            // → id (same)
  title: string         // → title (same)
  excerpt: string       // → excerpt (same)
  author?: string       // → author: { name: string }
  date?: string         // → publishedAt
  image?: string        // → coverImage
  category?: string     // → category (same)
  tags?: string[]       // → tags (same)
}
```

**Decision**: Create mapping utilities in `packages/frontend/src/lib/manifest-mappers.ts`
**Rationale**: Centralized conversion, testable, reusable
**Alternatives Considered**:
- Inline conversion in LayoutRenderer: Rejected - violates SRP

### 5. Manifest Component Dependencies

**Task**: Identify required base components and utilities

**Findings**:
- Table requires: `button`, `checkbox`, `lucide-react`
- BlogPostList requires: `button`, `lucide-react`
- Both require: `cn()` utility from `@/lib/utils`

**Decision**: Install shadcn/ui base components (button, checkbox) and lucide-react
**Rationale**: Required by Manifest components, already compatible with Tailwind setup
**Alternatives Considered**:
- Mock the dependencies: Rejected - would break component functionality

### 6. MCP Server HTML Rendering Strategy

**Task**: Determine how to render Manifest components in server-side HTML

**Findings**:
- Current templates use static HTML with theme variable injection
- Manifest components are React-based, require client-side JavaScript
- Options: SSR, CDN-hosted bundle, or pre-rendered HTML

**Decision**: Use CDN-hosted React bundle with Manifest components for MCP HTML
**Rationale**: Simplest approach for POC, avoids SSR complexity
**Alternatives Considered**:
- Full SSR with NestJS: Rejected - significant complexity for POC
- Pre-render to static HTML: Rejected - loses interactivity (sorting, selection)

### 7. Dark Mode Support

**Task**: Understand how Manifest components handle dark mode

**Findings**:
- Manifest components use Tailwind CSS classes with CSS variables
- Dark mode controlled via `dark` class on root element
- Theme variables map to CSS custom properties

**Decision**: Pass theme mode to Manifest components via Tailwind dark class
**Rationale**: Native Tailwind approach, already supported in current implementation
**Alternatives Considered**:
- Custom theme prop: Rejected - would require component modification

## Resolved Clarifications

| Original Unknown | Resolution |
|-----------------|------------|
| Manifest component installation method | shadcn CLI with custom registry URL |
| Data structure compatibility | Create mapping layer, keep internal types |
| Server-side rendering approach | CDN-hosted React bundle for MCP |
| Dark mode mechanism | Tailwind CSS `dark` class |

## Dependencies Identified

| Dependency | Version | Purpose |
|------------|---------|---------|
| lucide-react | latest | Icon library for Manifest components |
| clsx | latest | Class name utility (if not present) |
| tailwind-merge | latest | Tailwind class merging (if not present) |

## Next Steps

1. Proceed to Phase 1: Data Model design
2. Define mapping function signatures
3. Document component installation commands
