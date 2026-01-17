'use client'

import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'
import { Calendar, Clock, ExternalLink } from 'lucide-react'
import { Post } from './post-card'

// Import shared OpenAI types
import '@/lib/openai-types' // Side effect: extends Window interface

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '')
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength).trim() + '...'
}

function TagList({
  tags,
  maxVisible = 2,
  size = 'default'
}: {
  tags: string[]
  maxVisible?: number
  size?: 'small' | 'default'
}) {
  const visibleTags = tags.slice(0, maxVisible)
  const remainingTags = tags.slice(maxVisible)
  const hasMore = remainingTags.length > 0

  const tagClass =
    size === 'small'
      ? 'rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium'
      : 'rounded-full bg-muted px-3 py-1 text-xs font-medium'

  return (
    <>
      {visibleTags.map((tag) => (
        <span key={tag} className={tagClass}>
          {tag}
        </span>
      ))}
      {hasMore && (
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={`${tagClass} cursor-default`}>
                +{remainingTags.length}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>{remainingTags.join(', ')}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </>
  )
}

const defaultPost: Post = {
  title: 'Getting Started with Agentic UI Components',
  excerpt:
    'Learn how to build conversational interfaces with our comprehensive component library designed for AI-powered applications.',
  coverImage:
    '/demo/images/tech-react.jpg',
  author: {
    name: 'Sarah Chen',
    avatar: '/demo/avatars/sarah-150.jpg'
  },
  publishedAt: '2024-01-15',
  readTime: '5 min read',
  tags: ['Tutorial', 'Components', 'AI', 'React', 'TypeScript'],
  category: 'Tutorial'
}

const defaultContent = `
  <p>Building modern AI-powered applications requires a new approach to UI design. Traditional web components don't always translate well to conversational interfaces, where context and flow are paramount.</p>

  <p>Our Agentic UI component library provides a collection of purpose-built components that work seamlessly within chat interfaces. From payment flows to product displays, each component is designed with the unique constraints of conversational UIs in mind.</p>

  <h2>Key Features</h2>
  <p>Each component supports three display modes: inline (within the chat flow), fullscreen (for complex interactions), and picture-in-picture (persistent visibility). This flexibility allows you to create rich, interactive experiences without breaking the conversational flow.</p>

  <p>Components are designed mobile-first and touch-friendly, ensuring a great experience across all devices. They automatically adapt to light and dark themes, and integrate seamlessly with MCP tools for backend communication.</p>
`

/**
 * Default related posts for demonstration.
 * @constant
 */
const defaultRelatedPosts: Post[] = [
  {
    title: 'Designing for Conversational Interfaces',
    excerpt:
      'Best practices for creating intuitive UI components that work within chat environments.',
    coverImage:
      '/demo/images/tech-ux.jpg',
    author: {
      name: 'Alex Rivera',
      avatar: '/demo/avatars/alex-150.jpg'
    },
    publishedAt: '2024-01-12',
    readTime: '8 min read',
    tags: ['Design', 'UX'],
    category: 'Design',
    url: 'https://example.com/posts/designing-conversational-interfaces'
  },
  {
    title: 'MCP Integration Patterns',
    excerpt:
      'How to leverage Model Context Protocol for seamless backend communication in your agentic applications.',
    coverImage:
      '/demo/images/tech-cloud.jpg',
    author: {
      name: 'Jordan Kim',
      avatar: '/demo/avatars/jordan-150.jpg'
    },
    publishedAt: '2024-01-10',
    readTime: '12 min read',
    tags: ['MCP', 'Backend', 'Integration'],
    category: 'Development',
    url: 'https://example.com/posts/mcp-integration-patterns'
  },
  {
    title: 'Building Payment Flows in Chat',
    excerpt:
      'A complete guide to implementing secure, user-friendly payment experiences within conversational interfaces.',
    coverImage:
      '/demo/images/tech-ecommerce.jpg',
    author: {
      name: 'Morgan Lee',
      avatar: '/demo/avatars/morgan-150.jpg'
    },
    publishedAt: '2024-01-08',
    readTime: '10 min read',
    tags: ['Payments', 'Security'],
    url: 'https://example.com/posts/building-payment-flows',
    category: 'Tutorial'
  }
]

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PostDetailProps
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Props for the PostDetail component, a full post detail view with Medium-style typography.
 */
export interface PostDetailProps {
  data?: {
    /** The main blog post to display. */
    post?: Post
    /** HTML content of the post body. */
    content?: string
    /** Related posts to show at the bottom of the article. */
    relatedPosts?: Post[]
  }
  actions?: {
    /** Called when the back button is clicked. */
    onBack?: () => void
    /** Called when the read more button is clicked (inline mode). */
    onReadMore?: () => void
    /** Called when a related post is clicked. */
    onReadRelated?: (post: Post) => void
  }
  appearance?: {
    /**
     * Whether to show the cover image.
     * @default true
     */
    showCover?: boolean
    /**
     * Whether to show author information.
     * @default true
     */
    showAuthor?: boolean
    /**
     * Display mode for the component.
     * @default "fullscreen"
     */
    displayMode?: 'inline' | 'fullscreen'
  }
}

/**
 * A full post detail component with Medium-style typography.
 * Supports inline preview and fullscreen reading modes.
 *
 * Features:
 * - Medium-style typography and spacing
 * - Cover image display
 * - Author info with avatar
 * - Tag list with overflow tooltip
 * - Related posts section
 * - Inline (truncated) and fullscreen modes
 * - ChatGPT display mode integration
 *
 * @component
 * @example
 * ```tsx
 * <PostDetail
 *   data={{
 *     post: {
 *       id: "1",
 *       title: "Getting Started",
 *       excerpt: "Learn the basics...",
 *       coverImage: "https://example.com/cover.jpg",
 *       author: { name: "Sarah Chen", avatar: "https://example.com/avatar.jpg" },
 *       publishedAt: "2024-01-15",
 *       readTime: "5 min read",
 *       tags: ["Tutorial", "Components"],
 *       category: "Tutorial"
 *     },
 *     content: "<p>Full post content here...</p>",
 *     relatedPosts: [...]
 *   }}
 *   actions={{
 *     onReadMore: () => console.log("Expand to fullscreen"),
 *     onReadRelated: (post) => console.log("Read related:", post.title)
 *   }}
 *   appearance={{
 *     showCover: true,
 *     showAuthor: true,
 *     displayMode: "fullscreen"
 *   }}
 * />
 * ```
 */
export function PostDetail({ data, actions, appearance }: PostDetailProps) {
  const { post = defaultPost, content = defaultContent, relatedPosts = defaultRelatedPosts } = data ?? {}
  const { onReadMore } = actions ?? {}
  const { showCover = true, showAuthor = true, displayMode = 'fullscreen' } = appearance ?? {}

  // Handle "Read more" click - use callback if provided, otherwise request fullscreen from host
  const handleReadMore = () => {
    if (onReadMore) {
      onReadMore()
    } else if (typeof window !== 'undefined' && window.openai) {
      // Request fullscreen mode from ChatGPT host
      window.openai.requestDisplayMode({ mode: 'fullscreen' })
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const plainTextContent = stripHtml(content)
  const truncatedContent = truncateText(plainTextContent, 340)
  const isInline = displayMode === 'inline'

  if (isInline) {
    return (
      <div className="rounded-lg border bg-card">
        {showCover && post.coverImage && (
          <div className="aspect-video overflow-hidden rounded-t-lg">
            <img
              src={post.coverImage}
              alt={post.title}
              className="h-full w-full object-cover"
            />
          </div>
        )}

        <div className="p-4">
          {post.category && (
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {post.category}
            </p>
          )}

          <h1 className="text-xl font-bold">{post.title}</h1>

          <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDate(post.publishedAt)}
            </span>
            {post.readTime && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {post.readTime}
              </span>
            )}
          </div>

          <p className="mt-3 text-sm text-muted-foreground">
            {truncatedContent}
          </p>

          {post.tags && post.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <TagList tags={post.tags} maxVisible={2} size="small" />
            </div>
          )}

          <div className="mt-4">
            <Button onClick={handleReadMore}>
              Read more
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Fullscreen mode
  return (
    <div className="min-h-screen bg-background">
      <article className="mx-auto w-full max-w-[680px] px-6 py-10">
        {showCover && post.coverImage && (
          <div className="aspect-video w-full overflow-hidden rounded-lg mb-8">
            <img
              src={post.coverImage}
              alt={post.title}
              className="h-full w-full object-cover"
            />
          </div>
        )}
        {post.category && (
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {post.category}
          </p>
        )}

        <h1 className="text-[32px] font-bold leading-[1.25] tracking-tight md:text-[42px]">
          {post.title}
        </h1>

        {post.tags && post.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <TagList tags={post.tags} maxVisible={2} size="default" />
          </div>
        )}

        {showAuthor && (
          <div className="mt-8 flex items-center gap-4 border-b pb-8">
            {post.author.avatar && (
              <img
                src={post.author.avatar}
                alt={post.author.name}
                className="h-12 w-12 rounded-full"
              />
            )}
            <div>
              <p className="font-medium">{post.author.name}</p>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatDate(post.publishedAt)}
                </span>
                {post.readTime && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {post.readTime}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Medium-style content */}
        <div className="mt-10">
          <p className="text-[21px] leading-[1.8] text-muted-foreground mb-8">
            {post.excerpt}
          </p>
          {content && (
            <div
              className="
                text-[21px] leading-[1.8] tracking-[-0.003em]
                [&>p]:mb-8
                [&>h2]:text-[26px] [&>h2]:font-bold [&>h2]:mt-12 [&>h2]:mb-4 [&>h2]:leading-[1.3]
                [&>h3]:text-[22px] [&>h3]:font-bold [&>h3]:mt-10 [&>h3]:mb-3 [&>h3]:leading-[1.3]
                [&>ul]:mb-8 [&>ul]:pl-6 [&>ul>li]:mb-2
                [&>ol]:mb-8 [&>ol]:pl-6 [&>ol>li]:mb-2
                [&>blockquote]:border-l-4 [&>blockquote]:border-foreground [&>blockquote]:pl-6 [&>blockquote]:my-8 [&>blockquote]:italic
              "
              dangerouslySetInnerHTML={{ __html: content }}
            />
          )}
        </div>

        {relatedPosts && relatedPosts.length > 0 && (
          <div className="mt-16 border-t pt-10">
            <h3 className="mb-6 text-lg font-semibold">Related Posts</h3>
            <div className="space-y-4">
              {relatedPosts.map((related, index) => (
                <a
                  key={index}
                  href={related.url || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center gap-4 rounded-lg p-3 text-left transition-colors hover:bg-muted cursor-pointer"
                >
                  {related.coverImage && (
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg">
                      <img
                        src={related.coverImage}
                        alt={related.title}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{related.title}</p>
                    <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                      {related.excerpt}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {related.readTime}
                    </p>
                  </div>
                  <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
                </a>
              ))}
            </div>
          </div>
        )}
      </article>
    </div>
  )
}
