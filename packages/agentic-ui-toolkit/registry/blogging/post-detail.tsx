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
  id: '1',
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

const defaultRelatedPosts: Post[] = [
  {
    id: '2',
    title: 'Designing for Conversational Interfaces',
    excerpt:
      'Best practices for creating intuitive UI components that work within chat environments.',
    coverImage:
      'https://images.unsplash.com/photo-1559028012-481c04fa702d?w=800',
    author: {
      name: 'Alex Rivera',
      avatar: 'https://i.pravatar.cc/150?u=alex'
    },
    publishedAt: '2024-01-12',
    readTime: '8 min read',
    tags: ['Design', 'UX'],
    category: 'Design',
    url: 'https://example.com/posts/designing-conversational-interfaces'
  },
  {
    id: '3',
    title: 'MCP Integration Patterns',
    excerpt:
      'How to leverage Model Context Protocol for seamless backend communication in your agentic applications.',
    coverImage:
      'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800',
    author: {
      name: 'Jordan Kim',
      avatar: 'https://i.pravatar.cc/150?u=jordan'
    },
    publishedAt: '2024-01-10',
    readTime: '12 min read',
    tags: ['MCP', 'Backend', 'Integration'],
    category: 'Development',
    url: 'https://example.com/posts/mcp-integration-patterns'
  },
  {
    id: '4',
    title: 'Building Payment Flows in Chat',
    excerpt:
      'A complete guide to implementing secure, user-friendly payment experiences within conversational interfaces.',
    coverImage:
      'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800',
    author: {
      name: 'Morgan Lee',
      avatar: 'https://i.pravatar.cc/150?u=morgan'
    },
    publishedAt: '2024-01-08',
    readTime: '10 min read',
    tags: ['Payments', 'Security'],
    url: 'https://example.com/posts/building-payment-flows',
    category: 'Tutorial'
  }
]

export interface PostDetailProps {
  data?: {
    post?: Post
    content?: string
    relatedPosts?: Post[]
  }
  actions?: {
    onBack?: () => void
    onReadMore?: () => void
    onReadRelated?: (post: Post) => void
  }
  appearance?: {
    showCover?: boolean
    showAuthor?: boolean
    displayMode?: 'inline' | 'fullscreen'
  }
}

export function PostDetail({ data, actions, appearance }: PostDetailProps) {
  const { post = defaultPost, content = defaultContent, relatedPosts = defaultRelatedPosts } = data ?? {}
  const { onBack, onReadMore, onReadRelated } = actions ?? {}
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
              {relatedPosts.map((related) => (
                <a
                  key={related.id}
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
