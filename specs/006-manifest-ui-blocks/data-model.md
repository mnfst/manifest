# Data Model: Manifest UI Blocks Integration

**Feature**: 006-manifest-ui-blocks
**Date**: 2025-12-27

## Overview

This feature does not introduce new database entities. It focuses on data transformation between existing internal types and Manifest UI component props.

## Type Definitions

### Manifest Table Types (Target Format)

```typescript
// From Manifest UI registry
export interface ManifestTableColumn<T = Record<string, unknown>> {
  header: string
  accessor: keyof T | string
  sortable?: boolean
  width?: string
  align?: 'left' | 'center' | 'right'
  render?: (value: unknown, row: T, index: number) => React.ReactNode
}

export interface ManifestTableProps<T = Record<string, unknown>> {
  columns?: ManifestTableColumn<T>[]
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

### Manifest BlogPost Types (Target Format)

```typescript
// From Manifest UI registry
export interface ManifestBlogPost {
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

export interface ManifestBlogPostListProps {
  posts?: ManifestBlogPost[]
  variant?: 'list' | 'grid' | 'carousel'
  columns?: 2 | 3
  showAuthor?: boolean
  showCategory?: boolean
  onReadMore?: (post: ManifestBlogPost) => void
}
```

### Internal Types (Source Format - No Changes)

```typescript
// Existing in packages/shared/src/types/mock-data.ts
export interface TableColumn {
  key: string
  header: string
  type: 'text' | 'number' | 'date' | 'badge' | 'action'
}

export interface TableMockData {
  type: 'table'
  columns: TableColumn[]
  rows: Array<Record<string, unknown>>
}

export interface PostItem {
  id: string
  title: string
  excerpt: string
  author?: string
  date?: string
  image?: string
  category?: string
  tags?: string[]
}

export interface PostListMockData {
  type: 'post-list'
  posts: PostItem[]
}
```

## Data Mapping

### Table Mapping

| Internal Field | Manifest Field | Transformation |
|---------------|----------------|----------------|
| `TableColumn.key` | `accessor` | Direct copy |
| `TableColumn.header` | `header` | Direct copy |
| `TableColumn.type` | `render` | Convert to render function |
| `TableMockData.rows` | `data` | Direct copy |

**Render Function Mapping**:
- `'text'` → No render function (default)
- `'number'` → Format with locale (Intl.NumberFormat)
- `'date'` → Format as locale date string
- `'badge'` → Render with badge styling
- `'action'` → Render as action button (if applicable)

### PostItem → BlogPost Mapping

| Internal Field | Manifest Field | Transformation |
|---------------|----------------|----------------|
| `id` | `id` | Direct copy |
| `title` | `title` | Direct copy |
| `excerpt` | `excerpt` | Direct copy |
| `author` | `author.name` | Wrap in object `{ name: author }` |
| `date` | `publishedAt` | Direct copy (same format) |
| `image` | `coverImage` | Direct copy |
| `category` | `category` | Direct copy |
| `tags` | `tags` | Direct copy |
| *(missing)* | `readTime` | Optional, compute or omit |
| *(missing)* | `author.avatar` | Optional, omit |

## Mapping Functions

### Location: `packages/frontend/src/lib/manifest-mappers.ts`

```typescript
// Function signatures
export function mapTableColumnToManifest(
  column: TableColumn
): ManifestTableColumn

export function mapTableMockDataToManifest(
  data: TableMockData
): { columns: ManifestTableColumn[]; data: Record<string, unknown>[] }

export function mapPostItemToManifestBlogPost(
  post: PostItem
): ManifestBlogPost

export function mapPostListMockDataToManifest(
  data: PostListMockData
): { posts: ManifestBlogPost[] }
```

## Validation Rules

### Table Data
- `columns` array must not be empty
- Each column must have `key` and `header`
- `rows` array can be empty (shows empty state)
- Row objects should have keys matching column accessors

### Post List Data
- `posts` array can be empty (shows empty state)
- Each post must have `id`, `title`, and `excerpt`
- `author` field transforms to object even if empty string

## State Transitions

No state machines - this is a stateless data transformation layer.

## Backward Compatibility

| Concern | Resolution |
|---------|------------|
| Existing stored MockData | Transformation at render time, no migration |
| AI-generated data | Update prompts to generate Manifest-compatible format |
| Default mock data | Update DEFAULT_TABLE_MOCK_DATA and DEFAULT_POST_LIST_MOCK_DATA |

## Database Impact

**No database changes required**. The `ViewEntity.mockData` column stores JSON that is transformed at runtime.
