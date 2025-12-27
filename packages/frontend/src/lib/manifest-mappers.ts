import type { TableColumn, TableMockData, PostItem, PostListMockData } from '@chatgpt-app-builder/shared'

/**
 * Manifest Table Column type definition
 * Maps internal TableColumn to Manifest UI Table expected format
 */
export interface ManifestTableColumn<T = Record<string, unknown>> {
  header: string
  accessor: keyof T | string
  sortable?: boolean
  width?: string
  align?: 'left' | 'center' | 'right'
  render?: (value: unknown, row: T, index: number) => React.ReactNode
}

/**
 * Manifest BlogPost type definition
 * Maps internal PostItem to Manifest UI BlogPostList expected format
 */
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

/**
 * Maps an internal TableColumn to Manifest TableColumn format
 * Converts column type to appropriate render function
 */
export function mapTableColumnToManifest(column: TableColumn): ManifestTableColumn {
  const base: ManifestTableColumn = {
    header: column.header,
    accessor: column.key,
    sortable: true,
  }

  // Add render function and alignment based on column type
  switch (column.type) {
    case 'badge':
      base.render = (value) => {
        // Return a string that will be rendered with badge styling
        // The actual styling is handled by the Table component
        return String(value ?? '')
      }
      break
    case 'number':
      base.render = (value) => {
        if (typeof value === 'number') {
          return new Intl.NumberFormat('en-US').format(value)
        }
        return String(value ?? '')
      }
      base.align = 'right'
      break
    case 'date':
      base.render = (value) => {
        if (!value) return ''
        try {
          return new Date(String(value)).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          })
        } catch {
          return String(value)
        }
      }
      break
    case 'action':
      // Action columns don't need special render - handled by component
      break
    case 'text':
    default:
      // Text type uses default rendering
      break
  }

  return base
}

/**
 * Maps internal TableMockData to Manifest Table props format
 * Returns columns and data arrays ready for the Manifest Table component
 */
export function mapTableMockDataToManifest(data: TableMockData): {
  columns: ManifestTableColumn[]
  data: Record<string, unknown>[]
} {
  // Handle empty data gracefully
  if (!data.columns || data.columns.length === 0) {
    return { columns: [], data: [] }
  }

  return {
    columns: data.columns.map(mapTableColumnToManifest),
    data: data.rows ?? [],
  }
}

/**
 * Maps an internal PostItem to Manifest BlogPost format
 * Transforms author string to author object structure
 */
export function mapPostItemToManifestBlogPost(post: PostItem): ManifestBlogPost {
  return {
    id: post.id,
    title: post.title,
    excerpt: post.excerpt,
    coverImage: post.image,
    author: {
      name: post.author || 'Unknown',
      // avatar is optional and not available in internal format
    },
    publishedAt: post.date || new Date().toISOString().split('T')[0],
    // readTime is optional and not available in internal format
    tags: post.tags,
    category: post.category,
  }
}

/**
 * Maps internal PostListMockData to Manifest BlogPostList props format
 * Returns posts array ready for the Manifest BlogPostList component
 */
export function mapPostListMockDataToManifest(data: PostListMockData): {
  posts: ManifestBlogPost[]
} {
  // Handle empty data gracefully
  if (!data.posts || data.posts.length === 0) {
    return { posts: [] }
  }

  return {
    posts: data.posts.map(mapPostItemToManifestBlogPost),
  }
}
