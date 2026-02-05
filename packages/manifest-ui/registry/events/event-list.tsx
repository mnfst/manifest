'use client'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronLeft, ChevronRight, SlidersHorizontal, X } from 'lucide-react'
import { Suspense, useCallback, useRef, useState } from 'react'
import type { Event } from './types'
import { EventCard } from './event-card'
import { demoEvents } from './demo/events'
import { LazyLeafletMap, MapPlaceholder } from './shared'

// SVG pin marker - teardrop shape like Google Maps
function createPinSvg(isSelected: boolean) {
  const color = '#374151' // slate-700
  const ringColor = isSelected ? '#9ca3af' : 'transparent' // gray-400 ring when selected
  return `
    <svg width="32" height="42" viewBox="0 0 32 42" fill="none" xmlns="http://www.w3.org/2000/svg">
      ${isSelected ? `<circle cx="16" cy="16" r="14" fill="none" stroke="${ringColor}" stroke-width="3"/>` : ''}
      <path d="M16 0C7.163 0 0 7.163 0 16c0 12 16 26 16 26s16-14 16-26c0-8.837-7.163-16-16-16z" fill="${color}"/>
      <circle cx="16" cy="16" r="6" fill="white"/>
    </svg>
  `
}

// Filter options
const categoryOptions = ['Music', 'Comedy', 'Classes', 'Sports', 'Food & Drink', 'Arts', 'Film', 'Nightlife', 'Wellness', 'Networking']
const dateOptions = ['Today', 'Tomorrow', 'This weekend', 'This week', 'Next week', 'This month', 'Custom range']
const neighborhoodOptions = ['Downtown', 'Hollywood', 'Santa Monica', 'Venice', 'Echo Park', 'Silver Lake', 'Los Feliz', 'DTLA', 'Arts District', 'Brentwood', 'Miracle Mile', 'Hollywood Hills', 'Elysian Park']
const priceOptions = ['Free', 'Under $25', '$25 - $50', '$50 - $100', '$100+']
const formatOptions = ['In-person', 'Online', 'Hybrid']

interface FilterState {
  categories: string[]
  dates: string[]
  neighborhoods: string[]
  prices: string[]
  formats: string[]
}

/**
 * Default empty filter state.
 * @constant
 */
const defaultFilters: FilterState = {
  categories: [],
  dates: [],
  neighborhoods: [],
  prices: [],
  formats: []
}

/**
 * Filter section component with expandable checkbox list.
 * @component
 */
function FilterSection({
  title,
  options,
  selected,
  onChange,
  defaultExpanded = true,
  showLimit = 5
}: {
  title: string
  options: string[]
  selected: string[]
  onChange: (values: string[]) => void
  defaultExpanded?: boolean
  showLimit?: number
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [showAll, setShowAll] = useState(false)

  const visibleOptions = showAll ? options : options.slice(0, showLimit)
  const hasMore = options.length > showLimit

  const toggleOption = (option: string) => {
    if (selected.includes(option)) {
      onChange(selected.filter(s => s !== option))
    } else {
      onChange([...selected, option])
    }
  }

  return (
    <div className="border-b border-border/50">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between py-4 text-sm font-medium hover:text-foreground/80 transition-colors"
      >
        <span>{title}</span>
        <ChevronDown className={cn(
          "h-4 w-4 text-muted-foreground transition-transform duration-200",
          expanded && "rotate-180"
        )} />
      </button>
      <div className={cn(
        "grid transition-all duration-200 ease-out",
        expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
      )}>
        <div className="overflow-hidden">
          <div className="space-y-2 pb-4">
            {visibleOptions.map(option => (
              <label
                key={option}
                className="flex items-center gap-3 cursor-pointer group"
              >
                <Checkbox
                  checked={selected.includes(option)}
                  onCheckedChange={() => toggleOption(option)}
                  className="h-4 w-4"
                />
                <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                  {option}
                </span>
              </label>
            ))}
            {hasMore && (
              <button
                onClick={() => setShowAll(!showAll)}
                className="mt-1 text-xs text-primary hover:text-primary/80 transition-colors"
              >
                {showAll ? 'Show less' : `View ${options.length - showLimit} more`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Filter panel that slides over the event list
function FilterPanel({
  isOpen,
  onClose,
  filters,
  onFiltersChange,
  onApply,
  onReset,
  resultCount
}: {
  isOpen: boolean
  onClose: () => void
  filters: FilterState
  onFiltersChange: (filters: FilterState) => void
  onApply: () => void
  onReset: () => void
  resultCount: number
}) {
  const activeFiltersCount = Object.values(filters).flat().length

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "absolute inset-0 bg-background/60 backdrop-blur-[2px] transition-opacity duration-300 z-10",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={cn(
          "absolute inset-0 bg-background z-20 flex flex-col transition-all duration-300 ease-out",
          isOpen
            ? "opacity-100 translate-x-0"
            : "opacity-0 -translate-x-4 pointer-events-none"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold">Filters</span>
            {activeFiltersCount > 0 && (
              <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
                {activeFiltersCount}
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onClose}
            aria-label="Close filters"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Filter sections */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
          <FilterSection
            title="Category"
            options={categoryOptions}
            selected={filters.categories}
            onChange={(categories) => onFiltersChange({ ...filters, categories })}
          />
          <FilterSection
            title="Date"
            options={dateOptions}
            selected={filters.dates}
            onChange={(dates) => onFiltersChange({ ...filters, dates })}
          />
          <FilterSection
            title="Neighborhood"
            options={neighborhoodOptions}
            selected={filters.neighborhoods}
            onChange={(neighborhoods) => onFiltersChange({ ...filters, neighborhoods })}
          />
          <FilterSection
            title="Price"
            options={priceOptions}
            selected={filters.prices}
            onChange={(prices) => onFiltersChange({ ...filters, prices })}
          />
          <FilterSection
            title="Format"
            options={formatOptions}
            selected={filters.formats}
            onChange={(formats) => onFiltersChange({ ...filters, formats })}
            showLimit={3}
          />
        </div>

        {/* Footer with actions */}
        <div className="border-t px-4 py-3 space-y-2">
          <Button
            className="w-full"
            onClick={onApply}
          >
            Show {resultCount} events
          </Button>
          {activeFiltersCount > 0 && (
            <Button
              variant="ghost"
              className="w-full text-muted-foreground hover:text-foreground"
              onClick={onReset}
            >
              Reset all filters
            </Button>
          )}
        </div>
      </div>
    </>
  )
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EventListProps
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Props for the EventList component. Supports list, grid, carousel, and
 * fullwidth (split-screen with map) layout variants with filtering capabilities.
 */
export interface EventListProps {
  data?: {
    /** Array of events to display. */
    events?: Event[]
    /** Optional title displayed above the list. */
    title?: string
  }
  actions?: {
    /** Called when an event card is clicked. */
    onEventSelect?: (event: Event) => void
  }
  appearance?: {
    /**
     * Layout variant for the event list.
     * @default "list"
     */
    variant?: 'list' | 'grid' | 'carousel' | 'fullwidth'
    /** Number of columns for grid layout. */
    columns?: 2 | 3 | 4
  }
}

/**
 * An event list component with multiple layout variants.
 * Supports list, grid, carousel, and fullwidth (split-screen with map) layouts.
 *
 * Features:
 * - Four layout variants (list, grid, carousel, fullwidth)
 * - Interactive map with event markers (fullwidth)
 * - Filter panel with categories, dates, neighborhoods, prices, formats
 * - Responsive carousel with navigation
 * - Event hover/selection sync between list and map
 * - Pagination support
 *
 * @component
 * @example
 * ```tsx
 * <EventList
 *   data={{
 *     events: [...],
 *     title: "Events near you"
 *   }}
 *   actions={{
 *     onEventSelect: (event) => console.log("Selected:", event.title),
 *     onExpand: () => console.log("Expand to fullscreen"),
 *     onFiltersApply: (filters) => console.log("Filters:", filters)
 *   }}
 *   appearance={{
 *     variant: "grid",
 *     columns: 3,
 *     eventsPerPage: 10
 *   }}
 * />
 * ```
 */
export function EventList({ data, actions, appearance }: EventListProps) {
  const resolved: NonNullable<EventListProps['data']> = data ?? { events: demoEvents }
  const events = resolved.events ?? []
  const title = resolved.title
  const onEventSelect = actions?.onEventSelect
  const variant = appearance?.variant ?? 'list'
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedEventIndex, setSelectedEventIndex] = useState<number | null>(null)

  // Filter state for fullwidth variant
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<FilterState>(defaultFilters)
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(defaultFilters)

  // Refs for fullwidth variant scroll functionality
  const listContainerRef = useRef<HTMLDivElement>(null)
  const eventItemRefs = useRef<Map<number, HTMLDivElement>>(new Map())

  // Scroll to event in list when selected from map
  const scrollToEvent = useCallback((eventIndex: number) => {
    const eventElement = eventItemRefs.current.get(eventIndex)
    if (eventElement && listContainerRef.current) {
      const container = listContainerRef.current
      const elementTop = eventElement.offsetTop
      const elementHeight = eventElement.offsetHeight
      const containerHeight = container.offsetHeight
      const scrollTo = elementTop - containerHeight / 2 + elementHeight / 2

      container.scrollTo({
        top: scrollTo,
        behavior: 'smooth'
      })
    }
  }, [])

  // Filter events based on applied filters
  const filterEvents = useCallback((eventsToFilter: Event[], filtersToApply: FilterState): Event[] => {
    return eventsToFilter.filter(event => {
      // Category filter
      if (filtersToApply.categories.length > 0) {
        if (!event.category || !filtersToApply.categories.includes(event.category)) return false
      }

      // Date filter - parse dateTime string for keywords
      if (filtersToApply.dates.length > 0) {
        const dateTimeLower = event.dateTime.toLowerCase()
        const dateMatch = filtersToApply.dates.some(dateOption => {
          if (dateOption === 'Today') {
            return dateTimeLower.includes('today') || dateTimeLower.includes('tonight')
          }
          if (dateOption === 'Tomorrow') {
            return dateTimeLower.includes('tomorrow')
          }
          if (dateOption === 'This weekend') {
            return dateTimeLower.includes('saturday') || dateTimeLower.includes('sunday')
          }
          if (dateOption === 'This week') {
            // Match any day name or "In X days" where X <= 7
            const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
            if (dayNames.some(day => dateTimeLower.includes(day))) return true
            if (dateTimeLower.includes('today') || dateTimeLower.includes('tonight') || dateTimeLower.includes('tomorrow')) return true
            const inDaysMatch = dateTimeLower.match(/in (\d+) day/)
            if (inDaysMatch && parseInt(inDaysMatch[1]) <= 7) return true
            return false
          }
          if (dateOption === 'Next week') {
            const inDaysMatch = dateTimeLower.match(/in (\d+) day/)
            if (inDaysMatch) {
              const days = parseInt(inDaysMatch[1])
              return days > 7 && days <= 14
            }
            return false
          }
          if (dateOption === 'This month') {
            // Accept all events for "this month" as a broad filter
            return true
          }
          // Custom range - accept all for now
          return true
        })
        if (!dateMatch) return false
      }

      // Neighborhood filter
      if (filtersToApply.neighborhoods.length > 0) {
        const eventNeighborhood = event.neighborhood || ''
        if (!filtersToApply.neighborhoods.some(n =>
          eventNeighborhood.toLowerCase().includes(n.toLowerCase())
        )) return false
      }

      // Price filter
      if (filtersToApply.prices.length > 0) {
        const priceMatch = filtersToApply.prices.some(priceRange => {
          const eventPriceRange = event.priceRange ?? ''
          if (priceRange === 'Free') {
            return eventPriceRange.toLowerCase().includes('free')
          }
          // Extract numeric price from event
          const priceNum = parseInt(eventPriceRange.replace(/[^0-9]/g, '')) || 0
          if (priceRange === 'Under $25') return priceNum < 25
          if (priceRange === '$25 - $50') return priceNum >= 25 && priceNum <= 50
          if (priceRange === '$50 - $100') return priceNum >= 50 && priceNum <= 100
          if (priceRange === '$100+') return priceNum >= 100
          return true
        })
        if (!priceMatch) return false
      }

      // Format filter - check if event is in-person, online, or hybrid
      if (filtersToApply.formats.length > 0) {
        const formatMatch = filtersToApply.formats.some(format => {
          // All demo events have venues, so they're all in-person
          // In a real app, you'd check for onlineUrl or locationType
          if (format === 'In-person') {
            return event.venue && event.city
          }
          if (format === 'Online') {
            // Would check for onlineUrl field
            return false
          }
          if (format === 'Hybrid') {
            // Would check for both venue and onlineUrl
            return false
          }
          return true
        })
        if (!formatMatch) return false
      }

      return true
    })
  }, [])

  // List variant
  if (variant === 'list') {
    return (
      <div className="space-y-3">
        {title && (
          <div className="mb-4">
            <h2 className="text-lg font-semibold">{title}</h2>
          </div>
        )}
        {events.slice(0, 3).map((event, index) => (
          <EventCard
            key={index}
            data={{ event }}
            appearance={{ variant: 'horizontal' }}
            actions={{ onClick: onEventSelect }}
          />
        ))}
      </div>
    )
  }

  // Grid variant (inline mode - show 3 events with images)
  if (variant === 'grid') {
    return (
      <div className="space-y-4">
        {title && (
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
          </div>
        )}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {events.slice(0, 3).map((event, index) => (
            <EventCard
              key={index}
              data={{ event }}
              appearance={{ variant: 'default' }}
              actions={{ onClick: onEventSelect }}
            />
          ))}
        </div>
      </div>
    )
  }

  // Fullwidth variant with split-screen layout (list on left, map on right)
  if (variant === 'fullwidth') {
    const handleEventHover = (eventIndex: number | null) => {
      setSelectedEventIndex(eventIndex)
    }

    const handleEventClick = (event: Event, index: number) => {
      setSelectedEventIndex(index)
      onEventSelect?.(event)
    }

    const handleMapMarkerClick = (event: Event, index: number) => {
      setSelectedEventIndex(index)
      scrollToEvent(index)
      onEventSelect?.(event)
    }

    const handleFilterButtonClick = () => {
      setFilters(appliedFilters)
      setShowFilters(true)
    }

    const handleApplyFilters = () => {
      setAppliedFilters(filters)
      setShowFilters(false)
    }

    const handleResetFilters = () => {
      setFilters(defaultFilters)
      setAppliedFilters(defaultFilters)
    }

    // Get filtered events
    const filteredEvents = filterEvents(events, appliedFilters)
    // Get preview count for filter panel (shows what would be selected)
    const previewFilteredCount = filterEvents(events, filters).length
    // Count of active filters
    const activeFiltersCount = Object.values(appliedFilters).flat().length

    return (
      <div className="flex h-full min-h-[600px] bg-background">
        {/* Left Panel - Event List */}
        <div className="w-full md:w-[50%] lg:w-[45%] xl:w-[40%] xl:max-w-[720px] flex-shrink-0 border-r flex flex-col relative">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
            <div className="flex items-center gap-2 min-w-0">
              {title && <span className="font-semibold truncate">{title}</span>}
              <span className="text-muted-foreground text-xs whitespace-nowrap">| {filteredEvents.length}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 flex-shrink-0"
              onClick={handleFilterButtonClick}
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span className="hidden sm:inline">Filters</span>
              {activeFiltersCount > 0 && (
                <span className="bg-primary text-primary-foreground text-xs px-1.5 py-0.5 rounded-full">
                  {activeFiltersCount}
                </span>
              )}
            </Button>
          </div>

          {/* Scrollable Event List */}
          <div ref={listContainerRef} className="flex-1 overflow-y-auto">
            {filteredEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <p className="text-muted-foreground">No events match your filters</p>
                <Button
                  variant="link"
                  className="mt-2"
                  onClick={handleResetFilters}
                >
                  Reset filters
                </Button>
              </div>
            ) : (
              filteredEvents.map((event, index) => (
                <div
                  key={index}
                  ref={(el) => {
                    if (el) eventItemRefs.current.set(index, el)
                  }}
                  className={cn(
                    'border-b transition-colors cursor-pointer',
                    selectedEventIndex === index && 'bg-accent'
                  )}
                  onMouseEnter={() => handleEventHover(index)}
                  onMouseLeave={() => handleEventHover(null)}
                  onClick={() => handleEventClick(event, index)}
                >
                  <div className="flex gap-3 p-3">
                    {/* Thumbnail */}
                    {event.image && (
                      <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-md bg-muted">
                        <img
                          src={event.image}
                          alt={event.title || 'Event image'}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    )}
                    {/* Event Info */}
                    <div className="flex-1 min-w-0">
                      {event.priceRange && (
                        <p className="font-semibold text-sm">{event.priceRange}</p>
                      )}
                      {(event.dateTime || event.category) && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                          {[event.dateTime, event.category].filter(Boolean).join(' · ')}
                        </p>
                      )}
                      {(event.venue || event.city) && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                          {[event.venue, event.city].filter(Boolean).join(', ')}
                        </p>
                      )}
                      {event.title && (
                        <p className="text-sm font-medium mt-1 line-clamp-1">{event.title}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Filter Panel Overlay */}
          <FilterPanel
            isOpen={showFilters}
            onClose={() => setShowFilters(false)}
            filters={filters}
            onFiltersChange={setFilters}
            onApply={handleApplyFilters}
            onReset={handleResetFilters}
            resultCount={previewFilteredCount}
          />
        </div>

        {/* Right Panel - Map */}
        <div className="hidden md:flex flex-1 relative">
          <Suspense fallback={<MapPlaceholder />}>
            <LazyLeafletMap
              center={[34.0522, -118.2437]}
              zoom={12}
              renderMarkers={({ Marker, L }) => (
                <>
                  {filteredEvents.map((event, index) => {
                    if (!event.coordinates) return null
                    const isSelected = selectedEventIndex === index
                    const icon = L.divIcon({
                      className: '',
                      html: `<div style="
                        position: absolute;
                        left: 50%;
                        top: 100%;
                        transform: translate(-50%, -100%);
                        z-index: ${isSelected ? '1000' : '1'};
                      ">${createPinSvg(isSelected)}</div>`,
                      iconSize: [32, 42],
                      iconAnchor: [16, 42]
                    })
                    return (
                      <Marker
                        key={index}
                        position={[event.coordinates.lat, event.coordinates.lng]}
                        icon={icon}
                        zIndexOffset={isSelected ? 1000 : 0}
                        eventHandlers={{
                          click: () => handleMapMarkerClick(event, index)
                        }}
                      />
                    )
                  })}
                </>
              )}
            />
          </Suspense>
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
        <div className="mb-4">
          <h2 className="text-lg font-semibold">{title}</h2>
        </div>
      )}
      <div className="overflow-hidden rounded-lg">
        {/* Mobile: 1 card, slides by 100% */}
        <div
          className="flex transition-transform duration-300 ease-out md:hidden"
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        >
          {events.map((event, index) => (
            <div key={index} className="w-full shrink-0 px-0.5">
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
          {events.map((event, index) => (
            <div key={index} className="w-1/2 shrink-0 px-1.5">
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
          {events.map((event, index) => (
            <div key={index} className="w-1/3 shrink-0 px-1.5">
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
            aria-label="Previous event"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={next}
            disabled={isAtEndMobile}
            aria-label="Next event"
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
            aria-label="Previous event"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={next}
            disabled={isAtEndTablet}
            aria-label="Next event"
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
            aria-label="Previous event"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={next}
            disabled={isAtEndDesktop}
            aria-label="Next event"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
