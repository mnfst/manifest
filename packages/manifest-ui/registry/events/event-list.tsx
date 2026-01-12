'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight, MapPin, SlidersHorizontal } from 'lucide-react'
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
  selectedId,
  onSelectEvent
}: {
  events: Event[]
  selectedId: string | null
  onSelectEvent: (event: Event) => void
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
      {events.map((event) => {
        if (!event.coordinates) return null
        const isSelected = selectedId === event.id

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
            key={event.id}
            position={[event.coordinates.lat, event.coordinates.lng]}
            icon={icon}
            zIndexOffset={isSelected ? 1000 : 0}
            eventHandlers={{
              click: () => onSelectEvent(event)
            }}
          />
        )
      })}
    </>
  )
}

const defaultEvents: Event[] = [
  {
    id: 'evt-1',
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
    id: 'evt-2',
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
    id: 'evt-3',
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
    id: 'evt-4',
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
    id: 'evt-5',
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
    id: 'evt-6',
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
    id: 'evt-7',
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
    id: 'evt-8',
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
    id: 'evt-9',
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
    id: 'evt-10',
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
    id: 'evt-11',
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
    id: 'evt-12',
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
    id: 'evt-13',
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
    id: 'evt-14',
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
    id: 'evt-15',
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

export interface EventListProps {
  data?: {
    events?: Event[]
    title?: string
  }
  actions?: {
    onEventSelect?: (event: Event) => void
    onPageChange?: (page: number) => void
    onViewMore?: () => void
    onFilterClick?: () => void
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
  const { onEventSelect, onViewMore, onFilterClick } = actions ?? {}
  const { variant = 'list' } = appearance ?? {}
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [isMounted, setIsMounted] = useState(false)

  // Refs for fullwidth variant scroll functionality
  const listContainerRef = useRef<HTMLDivElement>(null)
  const eventItemRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  // Scroll to event in list when selected from map
  const scrollToEvent = useCallback((eventId: string) => {
    const eventElement = eventItemRefs.current.get(eventId)
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

  // Grid variant (inline mode - show 3 events with images and View More button)
  if (variant === 'grid') {
    return (
      <div className="space-y-4">
        {title && (
          <h2 className="text-lg font-semibold">{title}</h2>
        )}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {events.slice(0, 3).map((event) => (
            <EventCard
              key={event.id}
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
    const handleEventHover = (eventId: string | null) => {
      setSelectedEventId(eventId)
    }

    const handleEventClick = (event: Event) => {
      setSelectedEventId(event.id)
      onEventSelect?.(event)
    }

    const handleMapMarkerClick = (event: Event) => {
      setSelectedEventId(event.id)
      scrollToEvent(event.id)
      onEventSelect?.(event)
    }

    return (
      <div className="flex h-full min-h-[600px] bg-background">
        {/* Left Panel - Event List */}
        <div className="w-full md:w-[400px] lg:w-[420px] flex-shrink-0 border-r flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              {title && <span className="font-semibold">{title}</span>}
              <span className="text-muted-foreground">|</span>
              <span className="text-muted-foreground">{events.length} Events</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={onFilterClick}
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span className="sr-only sm:not-sr-only">Filters</span>
            </Button>
          </div>

          {/* Scrollable Event List */}
          <div ref={listContainerRef} className="flex-1 overflow-y-auto">
            {events.map((event) => (
              <div
                key={event.id}
                ref={(el) => {
                  if (el) eventItemRefs.current.set(event.id, el)
                }}
                className={cn(
                  'border-b transition-colors cursor-pointer',
                  selectedEventId === event.id && 'bg-accent'
                )}
                onMouseEnter={() => handleEventHover(event.id)}
                onMouseLeave={() => handleEventHover(null)}
                onClick={() => handleEventClick(event)}
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
            ))}
          </div>
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
                events={events}
                selectedId={selectedEventId}
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
