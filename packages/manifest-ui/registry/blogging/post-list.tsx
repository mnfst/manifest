'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { Post, PostCard } from './post-card'

const defaultPosts: Post[] = [
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
  },
  {
    id: '5',
    title: 'Real-time Collaboration in AI Apps',
    excerpt:
      'Implementing WebSocket connections and real-time updates for collaborative agentic experiences.',
    coverImage:
      'https://images.unsplash.com/photo-1552664730-d307ca884978?w=800',
    author: {
      name: 'Casey Taylor',
      avatar: 'https://i.pravatar.cc/150?u=casey'
    },
    publishedAt: '2024-01-06',
    readTime: '15 min read',
    tags: ['WebSocket', 'Real-time', 'Collaboration'],
    category: 'Development'
  },
  {
    id: '6',
    title: 'Accessibility in Chat Interfaces',
    excerpt:
      'Making your conversational UI accessible to all users with screen readers and keyboard navigation.',
    coverImage:
      'https://images.unsplash.com/photo-1573164713988-8665fc963095?w=800',
    author: {
      name: 'Jamie Park',
      avatar: 'https://i.pravatar.cc/150?u=jamie'
    },
    publishedAt: '2024-01-04',
    readTime: '9 min read',
    tags: ['Accessibility', 'A11y', 'UX'],
    category: 'Design'
  },
  {
    id: '7',
    title: 'State Management for Complex Workflows',
    excerpt:
      'Managing complex multi-step workflows in agentic applications using modern state patterns.',
    coverImage:
      'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800',
    author: {
      name: 'Drew Martinez',
      avatar: 'https://i.pravatar.cc/150?u=drew'
    },
    publishedAt: '2024-01-02',
    readTime: '11 min read',
    tags: ['State', 'Workflow', 'Architecture'],
    category: 'Development'
  },
  {
    id: '8',
    title: 'Testing Conversational Components',
    excerpt:
      'Strategies for unit testing and integration testing of chat-based UI components.',
    coverImage:
      'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800',
    author: {
      name: 'Riley Johnson',
      avatar: 'https://i.pravatar.cc/150?u=riley'
    },
    publishedAt: '2023-12-30',
    readTime: '8 min read',
    tags: ['Testing', 'Quality', 'CI/CD'],
    category: 'Development'
  },
  {
    id: '9',
    title: 'Theming and Dark Mode Support',
    excerpt:
      'Implementing flexible theming systems with dark mode for agentic UI components.',
    coverImage:
      'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800',
    author: {
      name: 'Avery Williams',
      avatar: 'https://i.pravatar.cc/150?u=avery'
    },
    publishedAt: '2023-12-28',
    readTime: '7 min read',
    tags: ['Theming', 'Dark Mode', 'CSS'],
    category: 'Design'
  },
  {
    id: '10',
    title: 'Performance Optimization Techniques',
    excerpt:
      'Optimizing render performance and reducing bundle size in chat applications.',
    coverImage:
      'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800',
    author: {
      name: 'Quinn Anderson',
      avatar: 'https://i.pravatar.cc/150?u=quinn'
    },
    publishedAt: '2023-12-25',
    readTime: '13 min read',
    tags: ['Performance', 'Optimization', 'React'],
    category: 'Development'
  },
  {
    id: '11',
    title: 'Error Handling and Recovery',
    excerpt:
      'Graceful error handling patterns and user-friendly recovery flows in conversational UIs.',
    coverImage:
      'https://images.unsplash.com/photo-1504639725590-34d0984388bd?w=800',
    author: {
      name: 'Sage Thompson',
      avatar: 'https://i.pravatar.cc/150?u=sage'
    },
    publishedAt: '2023-12-22',
    readTime: '10 min read',
    tags: ['Error Handling', 'UX', 'Resilience'],
    category: 'Development'
  },
  {
    id: '12',
    title: 'Internationalization Best Practices',
    excerpt:
      'Making your agentic UI components work across languages and locales.',
    coverImage:
      'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=800',
    author: {
      name: 'Blake Garcia',
      avatar: 'https://i.pravatar.cc/150?u=blake'
    },
    publishedAt: '2023-12-20',
    readTime: '9 min read',
    tags: ['i18n', 'Localization', 'Global'],
    category: 'Design'
  },
  {
    id: '13',
    title: 'Mobile-First Chat Design',
    excerpt:
      'Designing conversational interfaces that work beautifully on mobile devices.',
    coverImage:
      'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=800',
    author: {
      name: 'Charlie Brown',
      avatar: 'https://i.pravatar.cc/150?u=charlie'
    },
    publishedAt: '2023-12-18',
    readTime: '8 min read',
    tags: ['Mobile', 'Responsive', 'Design'],
    category: 'Design'
  },
  {
    id: '14',
    title: 'Analytics and User Insights',
    excerpt:
      'Tracking user interactions and deriving insights from conversational UI usage.',
    coverImage:
      'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800',
    author: {
      name: 'Sydney Chen',
      avatar: 'https://i.pravatar.cc/150?u=sydney'
    },
    publishedAt: '2023-12-15',
    readTime: '11 min read',
    tags: ['Analytics', 'Insights', 'Data'],
    category: 'Tutorial'
  },
  {
    id: '15',
    title: 'Building Reusable Component Libraries',
    excerpt:
      'Creating a scalable component library for agentic UIs that teams can share.',
    coverImage:
      'https://images.unsplash.com/photo-1558655146-d09347e92766?w=800',
    author: {
      name: 'Taylor Swift',
      avatar: 'https://i.pravatar.cc/150?u=taylor'
    },
    publishedAt: '2023-12-12',
    readTime: '14 min read',
    tags: ['Components', 'Library', 'Scalability'],
    category: 'Development'
  }
]

export interface PostListProps {
  data?: {
    posts?: Post[]
  }
  actions?: {
    onReadMore?: (post: Post) => void
    onPageChange?: (page: number) => void
  }
  appearance?: {
    variant?: 'list' | 'grid' | 'carousel' | 'fullwidth'
    columns?: 2 | 3 | 4
    showAuthor?: boolean
    showCategory?: boolean
    postsPerPage?: number
  }
  control?: {
    currentPage?: number
  }
}

export function PostList({ data, actions, appearance, control }: PostListProps) {
  const { posts = defaultPosts } = data ?? {}
  const { onReadMore, onPageChange } = actions ?? {}
  const { variant = 'list', columns = 2, showAuthor = true, showCategory = true, postsPerPage = 10 } = appearance ?? {}
  const { currentPage: controlledPage } = control ?? {}
  const [currentIndex, setCurrentIndex] = useState(0)
  const [internalPage, setInternalPage] = useState(1)

  const currentPage = controlledPage ?? internalPage

  // List variant
  if (variant === 'list') {
    return (
      <div className="space-y-3">
        {posts.slice(0, 3).map((post) => (
          <PostCard
            key={post.id}
            data={{ post }}
            appearance={{ variant: "horizontal", showAuthor, showCategory }}
            actions={{ onReadMore }}
          />
        ))}
      </div>
    )
  }

  // Grid variant (inline mode - show only 4 posts)
  if (variant === 'grid') {
    return (
      <div
        className={cn(
          'grid gap-4 grid-cols-1',
          columns === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3'
        )}
      >
        {posts.slice(0, 4).map((post) => (
          <PostCard
            key={post.id}
            data={{ post }}
            appearance={{ variant: "compact", showImage: false, showAuthor, showCategory }}
            actions={{ onReadMore }}
          />
        ))}
      </div>
    )
  }

  // Fullwidth variant with pagination
  if (variant === 'fullwidth') {
    const totalPages = Math.ceil(posts.length / postsPerPage)
    const startIndex = (currentPage - 1) * postsPerPage
    const endIndex = startIndex + postsPerPage
    const paginatedPosts = posts.slice(startIndex, endIndex)

    const handlePageChange = (page: number) => {
      if (page >= 1 && page <= totalPages) {
        setInternalPage(page)
        onPageChange?.(page)
      }
    }

    const getGridColsClass = () => {
      switch (columns) {
        case 2:
          return 'sm:grid-cols-2'
        case 3:
          return 'sm:grid-cols-2 lg:grid-cols-3'
        case 4:
          return 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
        default:
          return 'sm:grid-cols-2'
      }
    }

    return (
      <div className="space-y-6 p-6">
        <div className={cn('grid gap-6 grid-cols-1', getGridColsClass())}>
          {paginatedPosts.map((post) => (
            <PostCard
              key={post.id}
              data={{ post }}
              appearance={{ variant: "default", showAuthor, showCategory }}
              actions={{ onReadMore }}
            />
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <Button
                  key={page}
                  variant={page === currentPage ? 'default' : 'outline'}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handlePageChange(page)}
                >
                  {page}
                </Button>
              ))}
            </div>

            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Page info */}
        <div className="text-center text-sm text-muted-foreground">
          Showing {startIndex + 1}-{Math.min(endIndex, posts.length)} of {posts.length} posts
        </div>
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
              <PostCard
                data={{ post }}
                appearance={{ variant: "compact", showAuthor, showCategory }}
                actions={{ onReadMore }}
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
              <PostCard
                data={{ post }}
                appearance={{ variant: "compact", showAuthor, showCategory }}
                actions={{ onReadMore }}
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
              <PostCard
                data={{ post }}
                appearance={{ variant: "compact", showAuthor, showCategory }}
                actions={{ onReadMore }}
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
              aria-label={`Go to slide ${i + 1}`}
              className={cn(
                'h-1.5 rounded-full transition-all cursor-pointer',
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
            aria-label="Previous post"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={next}
            disabled={isAtEndMobile}
            aria-label="Next post"
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
            aria-label="Previous post"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={next}
            disabled={isAtEndTablet}
            aria-label="Next post"
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
            aria-label="Previous post"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={next}
            disabled={isAtEndDesktop}
            aria-label="Next post"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
