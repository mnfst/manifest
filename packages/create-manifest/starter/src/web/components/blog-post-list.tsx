import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { BlogPost, BlogPostCard } from './blog-post-card'

const defaultPosts: BlogPost[] = [
  {
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
  },
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

export interface BlogPostListProps {
  posts?: BlogPost[]
  variant?: 'list' | 'grid' | 'carousel'
  columns?: 2 | 3
  showAuthor?: boolean
  showCategory?: boolean
  onReadMore?: (post: BlogPost) => void
}

export function BlogPostList({
  posts = defaultPosts,
  variant = 'list',
  columns = 2,
  showAuthor = true,
  showCategory = true,
  onReadMore
}: BlogPostListProps) {
  const [currentIndex, setCurrentIndex] = useState(0)

  // List variant
  if (variant === 'list') {
    return (
      <div className="space-y-3">
        {posts.slice(0, 3).map((post) => (
          <BlogPostCard
            key={post.id}
            post={post}
            variant="horizontal"
            showAuthor={showAuthor}
            showCategory={showCategory}
            onReadMore={onReadMore}
          />
        ))}
      </div>
    )
  }

  // Grid variant
  if (variant === 'grid') {
    return (
      <div
        className={cn(
          'grid gap-4 grid-cols-1',
          columns === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3'
        )}
      >
        {posts.map((post) => (
          <BlogPostCard
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

  // Carousel variant
  const maxIndexMobile = posts.length - 1
  const maxIndexTablet = Math.max(0, posts.length - 2)
  const maxIndexDesktop = Math.max(0, posts.length - 3)

  const prev = () => {
    setCurrentIndex((i) => Math.max(0, i - 1))
  }

  const next = () => {
    setCurrentIndex((i) => i + 1)
  }

  const isAtStart = currentIndex === 0
  const isAtEndMobile = currentIndex >= maxIndexMobile
  const isAtEndTablet = currentIndex >= maxIndexTablet
  const isAtEndDesktop = currentIndex >= maxIndexDesktop

  return (
    <div className="relative">
      <div className="overflow-hidden rounded-lg">
        {/* Mobile: 1 card, slides by 100% */}
        <div
          className="flex transition-transform duration-300 ease-out md:hidden"
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        >
          {posts.map((post) => (
            <div key={post.id} className="w-full shrink-0 px-0.5">
              <BlogPostCard
                post={post}
                variant="compact"
                showAuthor={showAuthor}
                showCategory={showCategory}
                onReadMore={onReadMore}
              />
            </div>
          ))}
        </div>

        {/* Tablet: 2 cards visible, slides by 50% */}
        <div
          className="hidden md:flex lg:hidden transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${currentIndex * 50}%)` }}
        >
          {posts.map((post) => (
            <div key={post.id} className="w-1/2 shrink-0 px-1.5">
              <BlogPostCard
                post={post}
                variant="compact"
                showAuthor={showAuthor}
                showCategory={showCategory}
                onReadMore={onReadMore}
              />
            </div>
          ))}
        </div>

        {/* Desktop: 3 cards visible, slides by 33.333% */}
        <div
          className="hidden lg:flex transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${currentIndex * (100 / 3)}%)` }}
        >
          {posts.map((post) => (
            <div key={post.id} className="w-1/3 shrink-0 px-1.5">
              <BlogPostCard
                post={post}
                variant="compact"
                showAuthor={showAuthor}
                showCategory={showCategory}
                onReadMore={onReadMore}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between px-2">
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
        {/* Mobile navigation */}
        <div className="flex gap-1 md:hidden">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={prev}
            disabled={isAtStart}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={next}
            disabled={isAtEndMobile}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        {/* Tablet navigation */}
        <div className="hidden md:flex lg:hidden gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={prev}
            disabled={isAtStart}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={next}
            disabled={isAtEndTablet}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        {/* Desktop navigation */}
        <div className="hidden lg:flex gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={prev}
            disabled={isAtStart}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={next}
            disabled={isAtEndDesktop}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
