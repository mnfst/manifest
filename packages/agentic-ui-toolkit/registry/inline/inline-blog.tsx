'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  ArrowRight,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock
} from 'lucide-react'
import { useState } from 'react'

export interface BlogPost {
  id: string
  title: string
  excerpt: string
  content?: string
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

const defaultPost: BlogPost = {
  id: '1',
  title: 'Getting Started with Agentic UI Components',
  excerpt:
    'Learn how to build conversational interfaces with our comprehensive component library designed for AI-powered applications.',
  content: `
    <p>Building modern AI-powered applications requires a new approach to UI design. Traditional web components don't always translate well to conversational interfaces, where context and flow are paramount.</p>

    <p>Our Agentic UI component library provides a collection of purpose-built components that work seamlessly within chat interfaces. From payment flows to product displays, each component is designed with the unique constraints of conversational UIs in mind.</p>

    <h2>Key Features</h2>
    <p>Each component supports three display modes: inline (within the chat flow), fullscreen (for complex interactions), and picture-in-picture (persistent visibility). This flexibility allows you to create rich, interactive experiences without breaking the conversational flow.</p>

    <p>Components are designed mobile-first and touch-friendly, ensuring a great experience across all devices. They automatically adapt to light and dark themes, and integrate seamlessly with MCP tools for backend communication.</p>
  `,
  coverImage:
    'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800',
  author: {
    name: 'Sarah Chen',
    avatar: 'https://i.pravatar.cc/150?u=sarah'
  },
  publishedAt: '2024-01-15',
  readTime: '5 min read',
  tags: ['Tutorial', 'Components', 'AI'],
  category: 'Tutorial',
  url: '#'
}

const defaultPosts: BlogPost[] = [
  defaultPost,
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
    url: '#'
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
    url: '#'
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
    category: 'Tutorial',
    url: '#'
  }
]

// Blog Post Card Component
export interface InlineBlogPostCardProps {
  post?: BlogPost
  variant?: 'default' | 'compact' | 'horizontal'
  showImage?: boolean
  showAuthor?: boolean
  showCategory?: boolean
  onReadMore?: (post: BlogPost) => void
}

export function InlineBlogPostCard({
  post = defaultPost,
  variant = 'default',
  showImage = true,
  showAuthor = true,
  showCategory = true,
  onReadMore
}: InlineBlogPostCardProps) {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  if (variant === 'horizontal') {
    return (
      <div className="flex gap-4 rounded-lg border bg-card p-3 transition-colors hover:bg-muted/50">
        {showImage && post.coverImage && (
          <div className="h-24 w-24 shrink-0 overflow-hidden rounded-md">
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
              <span className="mb-1 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {post.category}
              </span>
            )}
            <h3 className="line-clamp-2 text-sm font-medium leading-tight">
              {post.title}
            </h3>
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
              {post.excerpt}
            </p>
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
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
        </div>
      </div>
    )
  }

  if (variant === 'compact') {
    return (
      <div className="rounded-lg border bg-card p-3 transition-colors hover:bg-muted/50">
        {showCategory && post.category && (
          <span className="mb-2 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            {post.category}
          </span>
        )}
        <h3 className="line-clamp-2 text-sm font-medium">{post.title}</h3>
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
          {post.excerpt}
        </p>
        <div className="mt-2 flex items-center justify-between">
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
          <Button
            variant="ghost"
            size="sm"
            className="h-auto p-0 text-xs"
            onClick={() => onReadMore?.(post)}
          >
            Read more
            <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        </div>
      </div>
    )
  }

  // Default variant
  return (
    <div className="overflow-hidden rounded-lg border bg-card transition-colors hover:bg-muted/50">
      {showImage && post.coverImage && (
        <div className="aspect-video overflow-hidden">
          <img
            src={post.coverImage}
            alt={post.title}
            className="h-full w-full object-cover transition-transform hover:scale-105"
          />
        </div>
      )}
      <div className="p-4">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {showCategory && post.category && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {post.category}
            </span>
          )}
          {post.tags &&
            post.tags.length > 0 &&
            post.tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
              >
                {tag}
              </span>
            ))}
        </div>
        <h3 className="line-clamp-2 font-medium">{post.title}</h3>
        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
          {post.excerpt}
        </p>
        <div className="mt-4 flex items-center justify-between">
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
          <Button variant="ghost" size="sm" onClick={() => onReadMore?.(post)}>
            Read
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

// Blog Post List Component
export interface InlineBlogPostListProps {
  posts?: BlogPost[]
  variant?: 'default' | 'compact' | 'horizontal'
  showAuthor?: boolean
  showCategory?: boolean
  onReadMore?: (post: BlogPost) => void
}

export function InlineBlogPostList({
  posts = defaultPosts.slice(0, 3),
  variant = 'horizontal',
  showAuthor = true,
  showCategory = true,
  onReadMore
}: InlineBlogPostListProps) {
  return (
    <div className="space-y-3">
      {posts.map((post) => (
        <InlineBlogPostCard
          key={post.id}
          post={post}
          variant={variant}
          showAuthor={showAuthor}
          showCategory={showCategory}
          onReadMore={onReadMore}
        />
      ))}
    </div>
  )
}

// Blog Post Grid Component
export interface InlineBlogPostGridProps {
  posts?: BlogPost[]
  columns?: 2 | 3
  showAuthor?: boolean
  showCategory?: boolean
  onReadMore?: (post: BlogPost) => void
}

export function InlineBlogPostGrid({
  posts = defaultPosts,
  columns = 2,
  showAuthor = true,
  showCategory = true,
  onReadMore
}: InlineBlogPostGridProps) {
  return (
    <div
      className={cn(
        'grid gap-4',
        columns === 2 ? 'grid-cols-2' : 'grid-cols-3'
      )}
    >
      {posts.map((post) => (
        <InlineBlogPostCard
          key={post.id}
          post={post}
          variant="compact"
          showImage={false}
          showAuthor={showAuthor}
          showCategory={showCategory}
          onReadMore={onReadMore}
        />
      ))}
    </div>
  )
}

// Blog Post Carousel Component
export interface InlineBlogPostCarouselProps {
  posts?: BlogPost[]
  showAuthor?: boolean
  showCategory?: boolean
  onReadMore?: (post: BlogPost) => void
}

export function InlineBlogPostCarousel({
  posts = defaultPosts,
  showAuthor = true,
  showCategory = true,
  onReadMore
}: InlineBlogPostCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0)

  const prev = () => {
    setCurrentIndex((i) => (i === 0 ? posts.length - 1 : i - 1))
  }

  const next = () => {
    setCurrentIndex((i) => (i === posts.length - 1 ? 0 : i + 1))
  }

  return (
    <div className="relative">
      <div className="overflow-hidden rounded-lg">
        <div
          className="flex transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        >
          {posts.map((post) => (
            <div key={post.id} className="w-full shrink-0 px-1">
              <InlineBlogPostCard
                post={post}
                showAuthor={showAuthor}
                showCategory={showCategory}
                onReadMore={onReadMore}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <div className="flex gap-1">
          {posts.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className={cn(
                'h-1.5 rounded-full transition-all',
                i === currentIndex
                  ? 'w-4 bg-foreground'
                  : 'w-1.5 bg-muted-foreground/30'
              )}
            />
          ))}
        </div>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={prev}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={next}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

// Blog Excerpt Card Component
export interface InlineBlogExcerptCardProps {
  post?: BlogPost
  initialExpanded?: boolean
  showAuthor?: boolean
  onReadFullArticle?: (post: BlogPost) => void
}

export function InlineBlogExcerptCard({
  post = defaultPost,
  initialExpanded = false,
  showAuthor = true,
  onReadFullArticle
}: InlineBlogExcerptCardProps) {
  const [expanded, setExpanded] = useState(initialExpanded)

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    })
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      {showAuthor && (
        <div className="flex items-start gap-3">
          {post.author.avatar && (
            <img
              src={post.author.avatar}
              alt={post.author.name}
              className="h-10 w-10 rounded-full"
            />
          )}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">{post.author.name}</span>
              <span className="text-xs text-muted-foreground">
                {formatDate(post.publishedAt)}
              </span>
            </div>
            <h3 className="mt-1 font-medium">{post.title}</h3>
          </div>
        </div>
      )}

      {!showAuthor && <h3 className="font-medium">{post.title}</h3>}

      <div className={cn('mt-3', showAuthor && 'ml-0')}>
        <p
          className={cn(
            'text-sm text-muted-foreground transition-all',
            !expanded && 'line-clamp-3'
          )}
        >
          {post.excerpt}
          {expanded && post.content && (
            <span
              className="mt-2 block"
              dangerouslySetInnerHTML={{ __html: post.content }}
            />
          )}
        </p>
      </div>

      <div className="mt-3 flex items-center justify-between border-t pt-3">
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
        <Button size="sm" onClick={() => onReadFullArticle?.(post)}>
          Read full article
          <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

// Article Detail Component
export interface InlineArticleDetailProps {
  post?: BlogPost
  showCover?: boolean
  showAuthor?: boolean
  relatedPosts?: BlogPost[]
  onBack?: () => void
  onReadRelated?: (post: BlogPost) => void
}

export function InlineArticleDetail({
  post = defaultPost,
  showCover = true,
  showAuthor = true,
  relatedPosts = defaultPosts.slice(1, 4),
  onBack,
  onReadRelated
}: InlineArticleDetailProps) {
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
          {post.content && (
            <div dangerouslySetInnerHTML={{ __html: post.content }} />
          )}
        </div>

        {relatedPosts && relatedPosts.length > 0 && (
          <div className="mt-6 border-t pt-4">
            <h3 className="mb-3 text-sm font-medium text-muted-foreground">
              Related Articles
            </h3>
            <div className="space-y-2">
              {relatedPosts.map((related) => (
                <button
                  key={related.id}
                  onClick={() => onReadRelated?.(related)}
                  className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-muted"
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

// Featured Article Component
export interface InlineFeaturedArticleProps {
  post?: BlogPost
  onReadMore?: (post: BlogPost) => void
}

export function InlineFeaturedArticle({
  post = defaultPost,
  onReadMore
}: InlineFeaturedArticleProps) {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    })
  }

  return (
    <div className="relative overflow-hidden rounded-lg">
      <div className="aspect-[16/9] w-full">
        {post.coverImage ? (
          <img
            src={post.coverImage}
            alt={post.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-muted" />
        )}
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
        <div className="mb-2 flex gap-1">
          {post.category && (
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs backdrop-blur-sm">
              {post.category}
            </span>
          )}
          {post.tags &&
            post.tags.slice(0, 1).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-white/20 px-2 py-0.5 text-xs backdrop-blur-sm"
              >
                {tag}
              </span>
            ))}
        </div>
        <h2 className="text-lg font-bold leading-tight">{post.title}</h2>
        <p className="mt-1 line-clamp-2 text-sm text-white/80">{post.excerpt}</p>
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {post.author.avatar && (
              <img
                src={post.author.avatar}
                alt={post.author.name}
                className="h-6 w-6 rounded-full ring-2 ring-white/30"
              />
            )}
            <div className="text-xs">
              <p className="font-medium">{post.author.name}</p>
              <p className="text-white/60">{formatDate(post.publishedAt)}</p>
            </div>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onReadMore?.(post)}
          >
            Read article
          </Button>
        </div>
      </div>
    </div>
  )
}
