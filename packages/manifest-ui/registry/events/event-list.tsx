'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import type { Event } from './types'
import { EventCard } from './event-card'

// Helper to generate dates relative to now
function getDateAt(daysFromNow: number, hour: number): string {
  const date = new Date()
  date.setDate(date.getDate() + daysFromNow)
  date.setHours(hour, 0, 0, 0)
  return date.toISOString()
}

const defaultEvents: Event[] = [
  {
    id: '1',
    title: 'House Music Night at The Loft',
    category: 'Music',
    venue: 'The Loft',
    neighborhood: 'SoHo',
    city: 'New York',
    startDateTime: getDateAt(0, 21), // Tonight 9 PM
    endDateTime: getDateAt(1, 3), // 3 AM next day
    priceRange: '$45 - $150',
    image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800',
    vibeTags: ['High energy', 'Late night', 'Dressy'],
    eventSignal: 'going-fast',
    organizerRating: 4.8,
    reviewCount: 234
  },
  {
    id: '2',
    title: 'Comedy Night with Top Local Comics',
    category: 'Comedy',
    venue: 'Laugh Factory',
    neighborhood: 'Times Square',
    city: 'New York',
    startDateTime: getDateAt(1, 20), // Tomorrow 8 PM
    priceRange: '$25 - $40',
    image: 'https://images.unsplash.com/photo-1585699324551-f6c309eedeca?w=800',
    vibeTags: ['Casual', 'Fun', 'Date night'],
    eventSignal: 'popular',
    organizerRating: 4.6,
    reviewCount: 189
  },
  {
    id: '3',
    title: 'Pottery Workshop for Beginners',
    category: 'Classes',
    venue: 'Clay Studio NYC',
    neighborhood: 'Williamsburg',
    city: 'Brooklyn',
    startDateTime: getDateAt(3, 14), // 3 days from now 2 PM
    priceRange: '$65',
    image: 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=800',
    vibeTags: ['Creative', 'Hands-on', 'Relaxing'],
    eventSignal: 'just-added',
    organizerRating: 4.9,
    reviewCount: 78
  },
  {
    id: '4',
    title: 'Rooftop Sunset Party',
    category: 'Nightlife',
    venue: 'Sky Lounge',
    neighborhood: 'Midtown',
    city: 'New York',
    startDateTime: getDateAt(2, 18), // 2 days from now 6 PM
    endDateTime: getDateAt(2, 23), // 11 PM
    priceRange: '$30 - $80',
    image: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800',
    vibeTags: ['Upscale', 'Views', 'Cocktails'],
    eventSignal: 'sales-end-soon',
    organizerRating: 4.7,
    reviewCount: 156
  },
  {
    id: '5',
    title: 'Basketball Game: Knicks vs Lakers',
    category: 'Sports',
    venue: 'Madison Square Garden',
    neighborhood: 'Midtown',
    city: 'New York',
    startDateTime: getDateAt(4, 19), // 4 days from now 7:30 PM
    priceRange: '$89 - $450',
    image: 'https://images.unsplash.com/photo-1504450758481-7338eba7524a?w=800',
    vibeTags: ['Exciting', 'Family-friendly'],
    organizerRating: 4.9,
    reviewCount: 1234
  },
  {
    id: '6',
    title: 'Jazz Night at Blue Note',
    category: 'Music',
    venue: 'Blue Note Jazz Club',
    neighborhood: 'Greenwich Village',
    city: 'New York',
    startDateTime: getDateAt(0, 20), // Tonight 8 PM
    endDateTime: getDateAt(0, 23), // 11 PM
    priceRange: '$35 - $85',
    image: 'https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?w=800',
    vibeTags: ['Intimate', 'Classic', 'Sophisticated'],
    eventSignal: 'popular',
    organizerRating: 4.8,
    reviewCount: 567
  },
  {
    id: '7',
    title: 'Wine Tasting Experience',
    category: 'Classes',
    venue: 'Vintner\'s Cellar',
    neighborhood: 'Upper East Side',
    city: 'New York',
    startDateTime: getDateAt(3, 16), // 3 days from now 4 PM
    priceRange: '$75',
    image: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=800',
    vibeTags: ['Educational', 'Social', 'Tasting'],
    organizerRating: 4.7,
    reviewCount: 92
  },
  {
    id: '8',
    title: 'Stand-Up Comedy Open Mic',
    category: 'Comedy',
    venue: 'The Comedy Cellar',
    neighborhood: 'Greenwich Village',
    city: 'New York',
    startDateTime: getDateAt(1, 21), // Tomorrow 9 PM
    priceRange: 'Free',
    image: 'https://images.unsplash.com/photo-1527224538127-2104bb71c51b?w=800',
    vibeTags: ['Casual', 'Underground', 'Discover'],
    eventSignal: 'just-added',
    organizerRating: 4.5,
    reviewCount: 234
  },
  {
    id: '9',
    title: 'Electronic Music Festival',
    category: 'Music',
    venue: 'Brooklyn Mirage',
    neighborhood: 'East Williamsburg',
    city: 'Brooklyn',
    startDateTime: getDateAt(3, 22), // 3 days from now 10 PM
    endDateTime: getDateAt(4, 6), // 6 AM next day
    priceRange: '$60 - $200',
    image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800',
    vibeTags: ['High energy', 'All night', 'Outdoor'],
    eventSignal: 'going-fast',
    organizerRating: 4.6,
    reviewCount: 789
  },
  {
    id: '10',
    title: 'Yoga in the Park',
    category: 'Classes',
    venue: 'Central Park',
    neighborhood: 'Upper West Side',
    city: 'New York',
    startDateTime: getDateAt(4, 8), // 4 days from now 8 AM
    priceRange: 'Free',
    image: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800',
    vibeTags: ['Wellness', 'Outdoor', 'Beginner-friendly'],
    organizerRating: 4.8,
    reviewCount: 156
  }
]

export interface EventListProps {
  data?: {
    events?: Event[]
    title?: string
  }
  actions?: {
    onEventSelect?: (event: Event) => void
    onPageChange?: (page: number) => void
  }
  appearance?: {
    variant?: 'list' | 'grid' | 'carousel' | 'fullwidth'
    columns?: 2 | 3 | 4
    eventsPerPage?: number
  }
  control?: {
    currentPage?: number
  }
}

export function EventList({ data, actions, appearance, control }: EventListProps) {
  const { events = defaultEvents, title } = data ?? {}
  const { onEventSelect, onPageChange } = actions ?? {}
  const { variant = 'list', columns = 2, eventsPerPage = 10 } = appearance ?? {}
  const { currentPage: controlledPage } = control ?? {}
  const [currentIndex, setCurrentIndex] = useState(0)
  const [internalPage, setInternalPage] = useState(1)

  const currentPage = controlledPage ?? internalPage

  // List variant
  if (variant === 'list') {
    return (
      <div className="space-y-3">
        {title && (
          <h2 className="text-lg font-semibold mb-4">{title}</h2>
        )}
        {events.slice(0, 3).map((event) => (
          <EventCard
            key={event.id}
            data={{ event }}
            appearance={{ variant: 'horizontal' }}
            actions={{ onClick: onEventSelect }}
          />
        ))}
      </div>
    )
  }

  // Grid variant (inline mode - show only 4 events)
  if (variant === 'grid') {
    return (
      <div className="space-y-4">
        {title && (
          <h2 className="text-lg font-semibold">{title}</h2>
        )}
        <div
          className={cn(
            'grid gap-4 grid-cols-1',
            columns === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3'
          )}
        >
          {events.slice(0, 4).map((event) => (
            <EventCard
              key={event.id}
              data={{ event }}
              appearance={{ variant: 'compact' }}
              actions={{ onClick: onEventSelect }}
            />
          ))}
        </div>
      </div>
    )
  }

  // Fullwidth variant with pagination
  if (variant === 'fullwidth') {
    const totalPages = Math.ceil(events.length / eventsPerPage)
    const startIndex = (currentPage - 1) * eventsPerPage
    const endIndex = startIndex + eventsPerPage
    const paginatedEvents = events.slice(startIndex, endIndex)

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
        {title && (
          <h2 className="text-xl font-semibold">{title}</h2>
        )}
        <div className={cn('grid gap-6 grid-cols-1', getGridColsClass())}>
          {paginatedEvents.map((event) => (
            <EventCard
              key={event.id}
              data={{ event }}
              appearance={{ variant: 'default' }}
              actions={{ onClick: onEventSelect }}
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
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Page info */}
        <div className="text-center text-sm text-muted-foreground">
          Showing {startIndex + 1}-{Math.min(endIndex, events.length)} of {events.length} events
        </div>
      </div>
    )
  }

  // Carousel variant
  const maxIndexMobile = events.length - 1
  const maxIndexTablet = Math.max(0, events.length - 2)
  const maxIndexDesktop = Math.max(0, events.length - 3)

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
      {title && (
        <h2 className="text-lg font-semibold mb-4">{title}</h2>
      )}
      <div className="overflow-hidden rounded-lg">
        {/* Mobile: 1 card, slides by 100% */}
        <div
          className="flex transition-transform duration-300 ease-out md:hidden"
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        >
          {events.map((event) => (
            <div key={event.id} className="w-full shrink-0 px-0.5">
              <EventCard
                data={{ event }}
                appearance={{ variant: 'compact' }}
                actions={{ onClick: onEventSelect }}
              />
            </div>
          ))}
        </div>

        {/* Tablet: 2 cards visible, slides by 50% */}
        <div
          className="hidden md:flex lg:hidden transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${currentIndex * 50}%)` }}
        >
          {events.map((event) => (
            <div key={event.id} className="w-1/2 shrink-0 px-1.5">
              <EventCard
                data={{ event }}
                appearance={{ variant: 'compact' }}
                actions={{ onClick: onEventSelect }}
              />
            </div>
          ))}
        </div>

        {/* Desktop: 3 cards visible, slides by 33.333% */}
        <div
          className="hidden lg:flex transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${currentIndex * (100 / 3)}%)` }}
        >
          {events.map((event) => (
            <div key={event.id} className="w-1/3 shrink-0 px-1.5">
              <EventCard
                data={{ event }}
                appearance={{ variant: 'compact' }}
                actions={{ onClick: onEventSelect }}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between px-2">
        <div className="flex gap-1">
          {events.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
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
