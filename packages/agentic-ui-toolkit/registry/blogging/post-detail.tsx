'use client'

import { Button } from '@/components/ui/button'
import { ArrowRight, Calendar, ChevronLeft, Clock } from 'lucide-react'
import { BlogPost } from './blog-post-card'

const defaultPost: BlogPost = {
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
  tags: ['Tutorial', 'Components', 'AI'],
  category: 'Tutorial'
}

const defaultContent = `
  <p>Building modern AI-powered applications requires a new approach to UI design. Traditional web components don't always translate well to conversational interfaces, where context and flow are paramount.</p>

  <p>Our Agentic UI component library provides a collection of purpose-built components that work seamlessly within chat interfaces. From payment flows to product displays, each component is designed with the unique constraints of conversational UIs in mind.</p>

  <h2>Key Features</h2>
  <p>Each component supports three display modes: inline (within the chat flow), fullscreen (for complex interactions), and picture-in-picture (persistent visibility). This flexibility allows you to create rich, interactive experiences without breaking the conversational flow.</p>

  <p>Components are designed mobile-first and touch-friendly, ensuring a great experience across all devices. They automatically adapt to light and dark themes, and integrate seamlessly with MCP tools for backend communication.</p>
`

const defaultRelatedPosts: BlogPost[] = [
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
    category: 'Design'
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
    category: 'Development'
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
    category: 'Tutorial'
  }
]

export interface PostDetailProps {
  data?: {
    post?: BlogPost
    content?: string
    relatedPosts?: BlogPost[]
  }
  actions?: {
    onBack?: () => void
    onReadRelated?: (post: BlogPost) => void
  }
  appearance?: {
    showCover?: boolean
    showAuthor?: boolean
  }
}

export function PostDetail({ data, actions, appearance }: PostDetailProps) {
  const { post = defaultPost, content = defaultContent, relatedPosts = defaultRelatedPosts } = data ?? {}
  const { onBack, onReadRelated } = actions ?? {}
  const { showCover = true, showAuthor = true } = appearance ?? {}
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    })
  }

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
        {onBack && (
          <Button
            variant="ghost"
            size="sm"
            className="mb-4 -ml-2"
            onClick={onBack}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Back
          </Button>
        )}

        <div className="mb-3 flex flex-wrap items-center gap-2">
          {post.category && (
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              {post.category}
            </span>
          )}
          {post.tags &&
            post.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium"
              >
                {tag}
              </span>
            ))}
        </div>

        <h1 className="text-xl font-bold">{post.title}</h1>

        {showAuthor && (
          <div className="mt-4 flex items-center gap-3 border-b pb-4">
            {post.author.avatar && (
              <img
                src={post.author.avatar}
                alt={post.author.name}
                className="h-10 w-10 rounded-full"
              />
            )}
            <div>
              <p className="font-medium">{post.author.name}</p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
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
            </div>
          </div>
        )}

        <div className="prose prose-sm mt-4 max-w-none dark:prose-invert">
          <p className="text-muted-foreground">{post.excerpt}</p>
          {content && <div dangerouslySetInnerHTML={{ __html: content }} />}
        </div>

        {relatedPosts && relatedPosts.length > 0 && (
          <div className="mt-6 border-t pt-4">
            <h3 className="mb-3 text-sm font-medium text-muted-foreground">
              Related Posts
            </h3>
            <div className="space-y-2">
              {relatedPosts.map((related) => (
                <button
                  key={related.id}
                  onClick={() => onReadRelated?.(related)}
                  className="flex w-full items-center gap-3 rounded-sm p-2 text-left transition-colors hover:bg-muted"
                >
                  {related.coverImage && (
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded">
                      <img
                        src={related.coverImage}
                        alt={related.title}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-sm font-medium">
                      {related.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {related.readTime}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
