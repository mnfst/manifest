'use client'

import { Button } from '@/components/ui/button'

// Import shared OpenAI types
import '@/lib/openai-types' // Side effect: extends Window interface

/**
 * Represents a blog post with metadata.
 * @interface Post
 * @property {string} id - Unique identifier for the post
 * @property {string} title - Post title
 * @property {string} excerpt - Brief description or summary
 * @property {string} [coverImage] - URL of the cover image
 * @property {object} author - Author information
 * @property {string} author.name - Author's display name
 * @property {string} [author.avatar] - Author's avatar URL
 * @property {string} publishedAt - ISO date string of publication
 * @property {string} [readTime] - Estimated read time (e.g., "5 min read")
 * @property {string[]} [tags] - Array of tag labels
 * @property {string} [category] - Category name
 * @property {string} [url] - External URL for the post
 */
export interface Post {
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
  url?: string
}

const defaultPost: Post = {
  title: 'Getting Started with Agentic UI Components',
  excerpt:
    'Learn how to build conversational interfaces with our comprehensive component library designed for AI-powered applications.',
  coverImage:
    'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800',
  author: {
    name: 'Sarah Chen',
    avatar: 'https://i.pravatar.cc/150?u=sarah'
  },
  publishedAt: '2024-01-15',
  readTime: '5 min read',
  tags: ['Tutorial', 'Components'],
  category: 'Tutorial'
}

/**
 * Props for the PostCard component.
 * @interface PostCardProps
 * @property {object} [data] - Post data
 * @property {Post} [data.post] - The post to display
 * @property {object} [actions] - Callback functions
 * @property {function} [actions.onReadMore] - Called when read more is clicked
 * @property {object} [appearance] - Visual customization
 * @property {"default" | "compact" | "horizontal" | "covered"} [appearance.variant] - Card layout variant
 * @property {boolean} [appearance.showImage] - Whether to show cover image
 * @property {boolean} [appearance.showAuthor] - Whether to show author info
 * @property {boolean} [appearance.showCategory] - Whether to show category
 */
export interface PostCardProps {
  data?: {
    post?: Post
  }
  actions?: {
    onReadMore?: (post: Post) => void
  }
  appearance?: {
    variant?: 'default' | 'compact' | 'horizontal' | 'covered'
    showImage?: boolean
    showAuthor?: boolean
    showCategory?: boolean
  }
}

/**
 * A blog post card component with multiple layout variants.
 * Supports default, compact, horizontal, and covered (overlay) styles.
 *
 * Features:
 * - Four layout variants (default, compact, horizontal, covered)
 * - Cover image with hover zoom effect
 * - Author avatar and info display
 * - Category and tags display
 * - Read more action button
 * - Responsive design
 *
 * @component
 * @example
 * ```tsx
 * <PostCard
 *   data={{
 *     post: {
 *       id: "1",
 *       title: "Getting Started Guide",
 *       excerpt: "Learn the basics of our component library.",
 *       coverImage: "https://example.com/image.jpg",
 *       author: { name: "Sarah Chen", avatar: "https://example.com/avatar.jpg" },
 *       publishedAt: "2024-01-15",
 *       readTime: "5 min read",
 *       tags: ["Tutorial", "Components"],
 *       category: "Tutorial"
 *     }
 *   }}
 *   actions={{
 *     onReadMore: (post) => console.log("Read more:", post.title)
 *   }}
 *   appearance={{
 *     variant: "default",
 *     showImage: true,
 *     showAuthor: true,
 *     showCategory: true
 *   }}
 * />
 * ```
 */
export function PostCard({ data, actions, appearance }: PostCardProps) {
  const { post = defaultPost } = data ?? {}
  const { onReadMore } = actions ?? {}
  const {
    variant = 'default',
    showImage = true,
    showAuthor = true,
    showCategory = true
  } = appearance ?? {}

  // Handle "Read more" click - only call callback if provided, otherwise do nothing
  // This lets users decide to use an external link or open fullscreen mode
  const handleReadMore = () => {
    if (onReadMore) {
      onReadMore(post)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  if (variant === 'covered') {
    return (
      <div className="relative overflow-hidden rounded-lg border">
        <div className="min-h-[280px] sm:aspect-[16/9] sm:min-h-0 w-full">
          {post.coverImage ? (
            <img
              src={post.coverImage}
              alt={post.title}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 h-full w-full bg-muted" />
          )}
        </div>
        {/* Minimal overlay - solid color instead of gradient per ChatGPT guidelines */}
        <div className="absolute inset-0 bg-black/60" />
        <div className="absolute inset-0 flex flex-col justify-end p-4 text-white">
          <div>
            {showCategory && post.category && (
              <p className="text-[10px] font-medium uppercase tracking-wide text-white/70">
                {post.category}
              </p>
            )}
            <h2 className="mt-1 text-lg font-semibold leading-tight">
              {post.title}
            </h2>
            <p className="mt-1 line-clamp-2 text-sm text-white/80">
              {post.excerpt}
            </p>
            {post.tags && post.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {post.tags.slice(0, 2).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md bg-white/20 px-2 py-0.5 text-xs"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {showAuthor && (
                <div className="flex items-center gap-2">
                  {post.author.avatar && (
                    <img
                      src={post.author.avatar}
                      alt={post.author.name}
                      className="h-6 w-6 rounded-full ring-1 ring-white/30"
                    />
                  )}
                  <div className="text-xs">
                    <p className="font-medium">{post.author.name}</p>
                    <p className="text-white/60">
                      {formatDate(post.publishedAt)}
                    </p>
                  </div>
                </div>
              )}
              <Button
                size="sm"
                variant="secondary"
                className="w-full sm:w-auto"
                onClick={handleReadMore}
              >
                Read article
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (variant === 'horizontal') {
    return (
      <div className="flex flex-col sm:flex-row gap-4 rounded-lg border bg-card p-3">
        {showImage && post.coverImage && (
          <div className="aspect-video sm:aspect-square sm:h-24 sm:w-24 shrink-0 overflow-hidden rounded-md">
            <img
              src={post.coverImage}
              alt={post.title}
              className="h-full w-full object-cover"
            />
          </div>
        )}
        <div className="flex flex-1 flex-col justify-between">
          <div>
            {showCategory && post.category && (
              <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {post.category}
              </p>
            )}
            <h3 className="line-clamp-2 text-sm font-medium leading-tight">
              {post.title}
            </h3>
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
              {post.excerpt}
            </p>
            {post.tags && post.tags.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {post.tags.slice(0, 2).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {showAuthor && post.author.avatar && (
                <img
                  src={post.author.avatar}
                  alt={post.author.name}
                  className="h-4 w-4 rounded-full"
                />
              )}
              <span>{formatDate(post.publishedAt)}</span>
              {post.readTime && (
                <>
                  <span>·</span>
                  <span>{post.readTime}</span>
                </>
              )}
            </div>
            <Button
              size="sm"
              className="w-full sm:w-auto"
              onClick={handleReadMore}
            >
              Read
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (variant === 'compact') {
    return (
      <div className="flex h-full flex-col justify-between rounded-lg border bg-card p-3">
        <div>
          {showCategory && post.category && (
            <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {post.category}
            </p>
          )}
          <h3 className="line-clamp-2 text-sm font-medium">{post.title}</h3>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
            {post.excerpt}
          </p>
          {post.tags && post.tags.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {post.tags.slice(0, 2).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            {showAuthor && post.author.avatar && (
              <img
                src={post.author.avatar}
                alt={post.author.name}
                className="h-5 w-5 rounded-full"
              />
            )}
            <span className="text-xs text-muted-foreground">
              {formatDate(post.publishedAt)}
            </span>
          </div>
          <Button size="sm" onClick={handleReadMore}>
            Read more
          </Button>
        </div>
      </div>
    )
  }

  // Default variant
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border bg-card">
      {showImage && post.coverImage && (
        <div className="aspect-video overflow-hidden">
          <img
            src={post.coverImage}
            alt={post.title}
            className="h-full w-full object-cover transition-transform hover:scale-105"
          />
        </div>
      )}
      <div className="flex flex-1 flex-col justify-between p-4">
        <div>
          {showCategory && post.category && (
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {post.category}
            </p>
          )}
          <h3 className="line-clamp-2 font-medium">{post.title}</h3>
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
            {post.excerpt}
          </p>
          {post.tags && post.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {post.tags.slice(0, 2).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {showAuthor && (
            <div className="flex items-center gap-2">
              {post.author.avatar && (
                <img
                  src={post.author.avatar}
                  alt={post.author.name}
                  className="h-6 w-6 rounded-full"
                />
              )}
              <div className="text-xs">
                <p className="font-medium">{post.author.name}</p>
                <p className="text-muted-foreground">
                  {formatDate(post.publishedAt)}
                </p>
              </div>
            </div>
          )}
          <Button size="sm" onClick={handleReadMore}>
            Read
          </Button>
        </div>
      </div>
    </div>
  )
}
