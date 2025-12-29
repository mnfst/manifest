'use client'

import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'

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
  tags: ['Tutorial', 'Components'],
  category: 'Tutorial'
}

export interface BlogPostCardProps {
  post?: BlogPost
  variant?: 'default' | 'compact' | 'horizontal' | 'covered'
  showImage?: boolean
  showAuthor?: boolean
  showCategory?: boolean
  onReadMore?: (post: BlogPost) => void
}

export function BlogPostCard({
  post = defaultPost,
  variant = 'default',
  showImage = true,
  showAuthor = true,
  showCategory = true,
  onReadMore
}: BlogPostCardProps) {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  if (variant === 'covered') {
    return (
      <div className="relative overflow-hidden rounded-lg">
        <div className="min-h-[320px] sm:aspect-[16/9] sm:min-h-0 w-full">
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
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />
        <div className="absolute inset-0 flex flex-col justify-between p-4 text-white">
          <div className="flex gap-1">
            {showCategory && post.category && (
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
          <div>
            <h2 className="text-lg font-bold leading-tight">{post.title}</h2>
            <p className="mt-1 line-clamp-2 text-sm text-white/80">
              {post.excerpt}
            </p>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {showAuthor && (
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
                onClick={() => onReadMore?.(post)}
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
      <div className="test flex flex-col sm:flex-row gap-4 rounded-lg border bg-card p-3 transition-colors hover:bg-muted/50">
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
              onClick={() => onReadMore?.(post)}
            >
              Read
              <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (variant === 'compact') {
    return (
      <div className="flex h-full flex-col justify-between rounded-lg border bg-card p-3 transition-colors hover:bg-muted/50">
        <div>
          {showCategory && post.category && (
            <span className="mb-2 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {post.category}
            </span>
          )}
          <h3 className="line-clamp-2 text-sm font-medium">{post.title}</h3>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
            {post.excerpt}
          </p>
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
          <Button size="sm" onClick={() => onReadMore?.(post)}>
            Read more
            <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        </div>
      </div>
    )
  }

  // Default variant
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border bg-card transition-colors hover:bg-muted/50">
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
          <Button size="sm" onClick={() => onReadMore?.(post)}>
            Read
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
