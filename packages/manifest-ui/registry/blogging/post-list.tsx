'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { Post, PostCard } from './post-card'
import { demoPosts } from './demo/data'

/**
 * Props for the PostList component.
 * @interface PostListProps
 * @property {object} [data] - Post data
 * @property {Post[]} [data.posts] - Array of posts to display
 * @property {object} [actions] - Callback functions
 * @property {function} [actions.onReadMore] - Called when read more is clicked
 * @property {function} [actions.onPageChange] - Called when page changes (fullwidth variant)
 * @property {object} [appearance] - Visual customization
 * @property {"list" | "grid" | "carousel" | "fullwidth"} [appearance.variant] - Layout variant
 * @property {2 | 3 | 4} [appearance.columns] - Number of columns for grid/fullwidth
 * @property {boolean} [appearance.showAuthor] - Whether to show author info
 * @property {boolean} [appearance.showCategory] - Whether to show category
 * @property {number} [appearance.postsPerPage] - Posts per page (fullwidth variant)
 * @property {object} [control] - State control
 * @property {number} [control.currentPage] - Controlled current page
 */
export interface PostListProps {
  /** Content and data to display */
  data?: {
    posts?: Post[]
  }
  /** User-triggerable callbacks */
  actions?: {
    onReadMore?: (post: Post) => void
    onPageChange?: (page: number) => void
  }
  /** Visual configuration options */
  appearance?: {
    variant?: 'list' | 'grid' | 'carousel' | 'fullwidth'
    columns?: 2 | 3 | 4
    showAuthor?: boolean
    showCategory?: boolean
    postsPerPage?: number
  }
  /** State management */
  control?: {
    currentPage?: number
  }
}

/**
 * A blog post list component with multiple layout variants.
 * Supports list, grid, carousel, and fullwidth paginated modes.
 *
 * Features:
 * - Four layout variants (list, grid, carousel, fullwidth)
 * - Responsive grid columns
 * - Carousel with touch-friendly navigation
 * - Fullwidth mode with pagination
 * - Configurable author and category display
 *
 * @component
 * @example
 * ```tsx
 * <PostList
 *   data={{
 *     posts: [
 *       {
 *         title: "Getting Started Guide",
 *         excerpt: "Learn the basics...",
 *         coverImage: "https://example.com/image.jpg",
 *         author: { name: "Sarah Chen" },
 *         publishedAt: "2024-01-15"
 *       }
 *     ]
 *   }}
 *   appearance={{
 *     variant: "grid",
 *     columns: 3,
 *     showAuthor: true
 *   }}
 *   actions={{
 *     onReadMore: (post) => console.log("Read:", post.title)
 *   }}
 * />
 * ```
 */
export function PostList({ data, actions, appearance, control }: PostListProps) {
  const { posts = demoPosts } = data ?? {}
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
        {posts.slice(0, 3).map((post, index) => (
          <PostCard
            key={index}
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
        {posts.slice(0, 4).map((post, index) => (
          <PostCard
            key={index}
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
          {paginatedPosts.map((post, index) => (
            <PostCard
              key={index}
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
          {posts.map((post, index) => (
            <div key={index} className="w-full shrink-0 px-0.5">
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
          {posts.map((post, index) => (
            <div key={index} className="w-1/2 shrink-0 px-1.5">
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
          {posts.map((post, index) => (
            <div key={index} className="w-1/3 shrink-0 px-1.5">
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
