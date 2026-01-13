'use client'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronLeft, ChevronRight, MapPin, Maximize2, SlidersHorizontal, X } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Event } from './types'
import { EventCard } from './event-card'

// Dynamically import map components to avoid SSR issues with Leaflet
const MapContainer = dynamic(
  () => import('react-leaflet').then((mod) => mod.MapContainer),
  { ssr: false }
)
const TileLayer = dynamic(
  () => import('react-leaflet').then((mod) => mod.TileLayer),
  { ssr: false }
)
const Marker = dynamic(
  () => import('react-leaflet').then((mod) => mod.Marker),
  { ssr: false }
)

// Map placeholder shown during SSR or when Leaflet isn't loaded
function MapPlaceholder() {
  return (
    <div className="h-full w-full bg-muted/30 flex items-center justify-center">
      <div className="flex flex-col items-center gap-2 text-muted-foreground">
        <MapPin className="h-8 w-8" />
        <span className="text-sm">Loading map...</span>
      </div>
    </div>
  )
}

// Inner map component that uses Leaflet hooks for event markers
function EventMapMarkers({
  events,
  selectedIndex,
  onSelectEvent
}: {
  events: Event[]
  selectedIndex: number | null
  onSelectEvent: (event: Event, index: number) => void
}) {
  const [L, setL] = useState<typeof import('leaflet') | null>(null)

  useEffect(() => {
    // Import Leaflet CSS and library on client side
    import('leaflet').then((leaflet) => {
      setL(leaflet.default)
    })
    // Add Leaflet CSS
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    document.head.appendChild(link)
    return () => {
      document.head.removeChild(link)
    }
  }, [])

  if (!L) return null

  // SVG pin marker - teardrop shape like Google Maps
  const createPinSvg = (isSelected: boolean) => {
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

  return (
    <>
      {events.map((event, index) => {
        if (!event.coordinates) return null
        const isSelected = selectedIndex === index

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
              click: () => onSelectEvent(event, index)
            }}
          />
        )
      })}
    </>
  )
}

const defaultEvents: Event[] = [
  {
    title: 'NEON Vol. 9',
    category: 'Music',
    venue: 'Echoplex',
    neighborhood: 'Echo Park',
    city: 'Los Angeles',
    dateTime: 'Tonight 9:00 PM - 3:00 AM',
    priceRange: '$45 - $150',
    image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800',
    coordinates: { lat: 34.0781, lng: -118.2606 },
    vibeTags: ['High energy', 'Late night'],
    eventSignal: 'going-fast',
    organizerRating: 4.8,
    reviewCount: 12453,
    ageRestriction: '21+'
  },
  {
    
    title: 'The Midnight Show',
    category: 'Comedy',
    venue: 'The Comedy Underground',
    neighborhood: 'Santa Monica',
    city: 'Los Angeles',
    dateTime: 'Tonight 10:00 PM - 12:00 AM',
    priceRange: '$15 - $35',
    image: 'https://images.unsplash.com/photo-1585699324551-f6c309eedeca?w=800',
    coordinates: { lat: 34.0195, lng: -118.4912 },
    vibeTags: ['Social', 'Late night'],
    eventSignal: 'popular',
    organizerRating: 4.7,
    reviewCount: 3241,
    discount: 'TONIGHT ONLY - 40% OFF'
  },
  {
    
    title: 'Salsa Sundays @ Echo Park',
    category: 'Classes',
    venue: 'Echo Park Lake',
    neighborhood: 'Echo Park',
    city: 'Los Angeles',
    dateTime: 'Saturday 6:00 PM - 10:00 PM',
    priceRange: 'Free',
    image: 'https://images.unsplash.com/photo-1504609813442-a8924e83f76e?w=800',
    coordinates: { lat: 34.0731, lng: -118.2608 },
    vibeTags: ['High energy', 'Social'],
    eventSignal: 'just-added',
    organizerRating: 4.9,
    reviewCount: 8764
  },
  {
    
    title: 'Dawn Flow: Griffith Park',
    category: 'Classes',
    venue: 'Griffith Park',
    neighborhood: 'Los Feliz',
    city: 'Los Angeles',
    dateTime: 'Tomorrow 6:00 AM - 8:00 AM',
    priceRange: 'Free',
    image: 'https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=800',
    coordinates: { lat: 34.1365, lng: -118.2943 },
    vibeTags: ['Chill', 'Wellness', 'Outdoor'],
    organizerRating: 4.9,
    reviewCount: 8764,
    discount: 'FREE - First 50 Only'
  },
  {
    
    title: 'Lakers vs Celtics',
    category: 'Sports',
    venue: 'Crypto.com Arena',
    neighborhood: 'Downtown',
    city: 'Los Angeles',
    dateTime: 'Friday 7:30 PM - 10:30 PM',
    priceRange: '$125 - $850',
    image: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800',
    coordinates: { lat: 34.0430, lng: -118.2673 },
    vibeTags: ['High energy', 'Social', 'Premium'],
    eventSignal: 'sales-end-soon',
    organizerRating: 4.5,
    reviewCount: 2341
  },
  {
    
    title: 'Smorgasburg LA: Sunday Market',
    category: 'Food & Drink',
    venue: 'ROW DTLA',
    neighborhood: 'Arts District',
    city: 'Los Angeles',
    dateTime: 'Sunday 10:00 AM - 4:00 PM',
    priceRange: 'Free',
    image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800',
    coordinates: { lat: 34.0341, lng: -118.2324 },
    vibeTags: ['Family-friendly', 'Outdoor', 'Social'],
    organizerRating: 4.8,
    reviewCount: 5632
  },
  {
    
    title: 'LACMA After Hours',
    category: 'Arts',
    venue: 'LACMA',
    neighborhood: 'Miracle Mile',
    city: 'Los Angeles',
    dateTime: 'Friday 7:00 PM - 11:00 PM',
    priceRange: '$35 - $75',
    image: 'https://images.unsplash.com/photo-1531243269054-5ebf6f34081e?w=800',
    coordinates: { lat: 34.0639, lng: -118.3592 },
    vibeTags: ['Chill', 'Date night', 'Sophisticated'],
    organizerRating: 4.7,
    reviewCount: 1234,
    ageRestriction: '21+',
    discount: 'MEMBER PRICE'
  },
  {
    
    title: 'Blue Note Under Stars',
    category: 'Music',
    venue: 'Hollywood Bowl',
    neighborhood: 'Hollywood Hills',
    city: 'Los Angeles',
    dateTime: 'Saturday 8:00 PM - 11:00 PM',
    priceRange: '$45 - $200',
    image: 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=800',
    coordinates: { lat: 34.1122, lng: -118.3391 },
    vibeTags: ['Chill', 'Date night', 'Outdoor'],
    lineup: ['Kamasi Washington', 'Thundercat', 'Terrace Martin'],
    organizerRating: 4.8,
    reviewCount: 12453
  },
  {
    
    title: 'Meraki: Seth Troxler',
    category: 'Nightlife',
    venue: 'Sound Nightclub',
    neighborhood: 'Hollywood',
    city: 'Los Angeles',
    dateTime: 'Saturday 10:00 PM - 4:00 AM',
    priceRange: '$35 - $65',
    image: 'https://images.unsplash.com/photo-1571266028243-e4733b0f0bb0?w=800',
    coordinates: { lat: 34.0928, lng: -118.3287 },
    vibeTags: ['High energy', 'Late night', 'Underground'],
    lineup: ['Amelie Lens', 'I Hate Models', 'FJAAK'],
    organizerRating: 4.6,
    reviewCount: 1876,
    ageRestriction: '21+'
  },
  {
    
    title: 'Whitney Cummings + Friends',
    category: 'Comedy',
    venue: 'The Laugh Factory',
    neighborhood: 'Hollywood',
    city: 'Los Angeles',
    dateTime: 'In 2 days 8:00 PM - 11:00 PM',
    priceRange: '$25 - $55',
    image: 'https://images.unsplash.com/photo-1527224538127-2104bb71c51b?w=800',
    coordinates: { lat: 34.0901, lng: -118.3615 },
    vibeTags: ['Chill', 'Social', 'Date night'],
    organizerRating: 4.7,
    reviewCount: 3241,
    ageRestriction: '18+'
  },
  {
    
    title: 'Venice Beach Drum Circle',
    category: 'Music',
    venue: 'Venice Beach Boardwalk',
    neighborhood: 'Venice',
    city: 'Los Angeles',
    dateTime: 'Sunday 4:00 PM - 8:00 PM',
    priceRange: 'Free',
    image: 'https://images.unsplash.com/photo-1506157786151-b8491531f063?w=800',
    coordinates: { lat: 33.9850, lng: -118.4695 },
    vibeTags: ['Outdoor', 'Social', 'Chill'],
    eventSignal: 'popular',
    organizerRating: 4.6,
    reviewCount: 2145
  },
  {
    
    title: 'Rooftop Cinema: Blade Runner',
    category: 'Film',
    venue: 'Rooftop Cinema Club',
    neighborhood: 'DTLA',
    city: 'Los Angeles',
    dateTime: 'Friday 8:30 PM - 11:00 PM',
    priceRange: '$25 - $45',
    image: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800',
    coordinates: { lat: 34.0407, lng: -118.2468 },
    vibeTags: ['Date night', 'Views', 'Chill'],
    organizerRating: 4.8,
    reviewCount: 892
  },
  {
    
    title: 'Dodgers vs Giants',
    category: 'Sports',
    venue: 'Dodger Stadium',
    neighborhood: 'Elysian Park',
    city: 'Los Angeles',
    dateTime: 'Saturday 1:10 PM - 4:30 PM',
    priceRange: '$35 - $350',
    image: 'https://images.unsplash.com/photo-1566577739112-5180d4bf9390?w=800',
    coordinates: { lat: 34.0739, lng: -118.2400 },
    vibeTags: ['Family-friendly', 'Social', 'High energy'],
    eventSignal: 'few-tickets-left',
    organizerRating: 4.7,
    reviewCount: 15678
  },
  {
    
    title: 'Natural Wine Fair',
    category: 'Food & Drink',
    venue: 'Grand Central Market',
    neighborhood: 'Downtown',
    city: 'Los Angeles',
    dateTime: 'Sunday 12:00 PM - 6:00 PM',
    priceRange: '$45 - $85',
    image: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=800',
    coordinates: { lat: 34.0508, lng: -118.2490 },
    vibeTags: ['Tasting', 'Social', 'Sophisticated'],
    eventSignal: 'just-added',
    organizerRating: 4.5,
    reviewCount: 567,
    ageRestriction: '21+'
  },
  {
    
    title: 'Meditation in the Gardens',
    category: 'Wellness',
    venue: 'The Getty Center',
    neighborhood: 'Brentwood',
    city: 'Los Angeles',
    dateTime: 'Sunday 7:00 AM - 9:00 AM',
    priceRange: 'Free',
    image: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800',
    coordinates: { lat: 34.0780, lng: -118.4741 },
    vibeTags: ['Wellness', 'Outdoor', 'Chill'],
    organizerRating: 4.9,
    reviewCount: 1234
  }
]

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

const defaultFilters: FilterState = {
  categories: [],
  dates: [],
  neighborhoods: [],
  prices: [],
  formats: []
}

// Filter section component
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

export interface EventListProps {
  data?: {
    events?: Event[]
    title?: string
  }
  actions?: {
    onEventSelect?: (event: Event) => void
    onPageChange?: (page: number) => void
    onViewMore?: () => void
    onExpand?: () => void
    onFilterClick?: () => void
    onFiltersApply?: (filters: FilterState) => void
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

export function EventList({ data, actions, appearance }: EventListProps) {
  const { events = defaultEvents, title } = data ?? {}
  const { onEventSelect, onViewMore, onExpand, onFilterClick, onFiltersApply } = actions ?? {}
  const { variant = 'list' } = appearance ?? {}
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedEventIndex, setSelectedEventIndex] = useState<number | null>(null)
  const [isMounted, setIsMounted] = useState(false)

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

  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Filter events based on applied filters
  const filterEvents = useCallback((eventsToFilter: Event[], filtersToApply: FilterState): Event[] => {
    return eventsToFilter.filter(event => {
      // Category filter
      if (filtersToApply.categories.length > 0) {
        if (!filtersToApply.categories.includes(event.category)) return false
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
          if (priceRange === 'Free') {
            return event.priceRange.toLowerCase().includes('free')
          }
          // Extract numeric price from event
          const priceNum = parseInt(event.priceRange.replace(/[^0-9]/g, '')) || 0
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
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">{title}</h2>
            {onExpand && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onExpand}
                aria-label="Expand view"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            )}
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

  // Grid variant (inline mode - show 3 events with images and View More button)
  if (variant === 'grid') {
    return (
      <div className="space-y-4">
        {title && (
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{title}</h2>
            {onExpand && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onExpand}
                aria-label="Expand view"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            )}
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
        {events.length > 3 && (
          <div className="flex justify-center pt-2">
            <Button
              variant="outline"
              onClick={onViewMore}
            >
              View more events
            </Button>
          </div>
        )}
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
      setFilters(appliedFilters) // Reset to applied filters when opening
      setShowFilters(true)
      onFilterClick?.()
    }

    const handleApplyFilters = () => {
      setAppliedFilters(filters)
      setShowFilters(false)
      onFiltersApply?.(filters)
    }

    const handleResetFilters = () => {
      setFilters(defaultFilters)
      setAppliedFilters(defaultFilters)
      onFiltersApply?.(defaultFilters)
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
                          alt={event.title}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    )}
                    {/* Event Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{event.priceRange}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                        {event.dateTime} · {event.category}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                        {event.venue}, {event.city}
                      </p>
                      <p className="text-sm font-medium mt-1 line-clamp-1">{event.title}</p>
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
          {isMounted ? (
            <MapContainer
              center={[34.0522, -118.2437]} // Los Angeles center
              zoom={12}
              style={{ height: '100%', width: '100%' }}
              zoomControl={true}
              scrollWheelZoom={true}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              />
              <EventMapMarkers
                events={filteredEvents}
                selectedIndex={selectedEventIndex}
                onSelectEvent={handleMapMarkerClick}
              />
            </MapContainer>
          ) : (
            <MapPlaceholder />
          )}
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
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          {onExpand && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onExpand}
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          )}
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
