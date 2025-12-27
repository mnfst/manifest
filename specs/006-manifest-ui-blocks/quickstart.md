# Quickstart: Manifest UI Blocks Integration

**Feature**: 006-manifest-ui-blocks
**Date**: 2025-12-27

## Prerequisites

- Node.js >= 18.0.0
- npm >= 10.0.0
- Existing generator monorepo set up

## Setup Steps

### 1. Install Base Dependencies

```bash
# From packages/frontend directory
cd packages/frontend

# Install lucide-react for icons
npm install lucide-react

# Install class utilities (if not present)
npm install clsx tailwind-merge
```

### 2. Add cn() Utility

Create `packages/frontend/src/lib/utils.ts`:

```typescript
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

### 3. Install shadcn/ui Base Components

```bash
# Initialize shadcn (if not done)
npx shadcn@latest init

# Install required base components
npx shadcn@latest add button checkbox
```

### 4. Install Manifest UI Components

```bash
# Install Table component from Manifest registry
npx shadcn@latest add https://ui.manifest.build/r/table.json

# Install BlogPostList component from Manifest registry
npx shadcn@latest add https://ui.manifest.build/r/blog-post-list.json
```

This will create:
- `src/components/ui/table.tsx` (Manifest Table)
- `src/components/ui/blog-post-list.tsx`
- `src/components/ui/blog-post-card.tsx`

### 5. Create Mapping Utilities

Create `packages/frontend/src/lib/manifest-mappers.ts`:

```typescript
import type { TableColumn, TableMockData, PostItem, PostListMockData } from '@chatgpt-app-builder/shared'

// Manifest types (imported from components or defined here)
export interface ManifestTableColumn<T = Record<string, unknown>> {
  header: string
  accessor: keyof T | string
  sortable?: boolean
  width?: string
  align?: 'left' | 'center' | 'right'
  render?: (value: unknown, row: T, index: number) => React.ReactNode
}

export interface ManifestBlogPost {
  id: string
  title: string
  excerpt: string
  coverImage?: string
  author: { name: string; avatar?: string }
  publishedAt: string
  readTime?: string
  tags?: string[]
  category?: string
}

// Mapping functions
export function mapTableColumnToManifest(column: TableColumn): ManifestTableColumn {
  const base: ManifestTableColumn = {
    header: column.header,
    accessor: column.key,
    sortable: true,
  }

  // Add render function based on type
  if (column.type === 'badge') {
    base.render = (value) => (
      <span className="px-2 py-1 rounded text-xs font-medium bg-primary/10 text-primary">
        {String(value)}
      </span>
    )
  } else if (column.type === 'number') {
    base.render = (value) => new Intl.NumberFormat('en-US').format(Number(value))
    base.align = 'right'
  } else if (column.type === 'date') {
    base.render = (value) => new Date(String(value)).toLocaleDateString()
  }

  return base
}

export function mapTableMockDataToManifest(data: TableMockData) {
  return {
    columns: data.columns.map(mapTableColumnToManifest),
    data: data.rows,
  }
}

export function mapPostItemToManifestBlogPost(post: PostItem): ManifestBlogPost {
  return {
    id: post.id,
    title: post.title,
    excerpt: post.excerpt,
    coverImage: post.image,
    author: { name: post.author || 'Unknown' },
    publishedAt: post.date || new Date().toISOString().split('T')[0],
    tags: post.tags,
    category: post.category,
  }
}

export function mapPostListMockDataToManifest(data: PostListMockData) {
  return {
    posts: data.posts.map(mapPostItemToManifestBlogPost),
  }
}
```

### 6. Update LayoutRenderer

Replace `packages/frontend/src/components/editor/LayoutRenderer.tsx`:

```typescript
import type { LayoutTemplate, MockData } from '@chatgpt-app-builder/shared'
import { isTableMockData, isPostListMockData } from '@chatgpt-app-builder/shared'
import { Table } from '@/components/ui/table'
import { BlogPostList } from '@/components/ui/blog-post-list'
import { mapTableMockDataToManifest, mapPostListMockDataToManifest } from '@/lib/manifest-mappers'

interface LayoutRendererProps {
  layoutTemplate: LayoutTemplate
  mockData: MockData
  isDarkMode?: boolean
}

export function LayoutRenderer({ layoutTemplate, mockData, isDarkMode = false }: LayoutRendererProps) {
  if (layoutTemplate === 'table' && isTableMockData(mockData)) {
    const { columns, data } = mapTableMockDataToManifest(mockData)
    return (
      <div className={isDarkMode ? 'dark' : ''}>
        <Table columns={columns} data={data} selectable="none" />
      </div>
    )
  }

  if (layoutTemplate === 'post-list' && isPostListMockData(mockData)) {
    const { posts } = mapPostListMockDataToManifest(mockData)
    return (
      <div className={isDarkMode ? 'dark' : ''}>
        <BlogPostList posts={posts} variant="list" />
      </div>
    )
  }

  return (
    <div className="p-4 text-center text-muted-foreground">
      Unsupported layout template: {layoutTemplate}
    </div>
  )
}
```

## Verification

### Test Table Rendering

1. Start dev server: `npm run dev`
2. Create or open an app with a table view
3. Verify:
   - Table renders with Manifest styling
   - Column headers show correctly
   - Row data displays properly
   - Responsive card view on mobile

### Test Post List Rendering

1. Create or open an app with a post-list view
2. Verify:
   - Posts render with Manifest BlogPostList styling
   - Author info displays correctly
   - Category badges appear
   - Responsive layout works

## Troubleshooting

### "Cannot find module '@/components/ui/table'"
- Ensure shadcn component was installed
- Check tsconfig paths include `@/*` alias

### "cn is not defined"
- Create lib/utils.ts with cn() function
- Install clsx and tailwind-merge

### Dark mode not working
- Ensure parent element has `dark` class
- Check Tailwind config includes darkMode: 'class'
