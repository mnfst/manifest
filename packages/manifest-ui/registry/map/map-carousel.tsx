'use client'

import { cn } from '@/lib/utils'
import { MapPin } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ComponentType } from 'react'

// Internal types for react-leaflet component attributes (not exported component props)
type LeafletMapContainerAttrs = {
  center: [number, number]
  zoom: number
  style?: React.CSSProperties
  zoomControl?: boolean
  scrollWheelZoom?: boolean
  children?: React.ReactNode
}

type LeafletTileLayerAttrs = {
  attribution: string
  url: string
}

type LeafletMarkerAttrs = {
  position: [number, number]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon?: any
  zIndexOffset?: number
  eventHandlers?: {
    click?: () => void
  }
}

// Lazy-loaded react-leaflet components (React-only, no Next.js dependency)
interface ReactLeafletComponents {
  MapContainer: ComponentType<LeafletMapContainerAttrs>
  TileLayer: ComponentType<LeafletTileLayerAttrs>
  Marker: ComponentType<LeafletMarkerAttrs>
}

/**
 * Hook to lazy load react-leaflet components on client-side only.
 * This avoids SSR issues with Leaflet without requiring Next.js dynamic imports.
 */
function useReactLeaflet(): ReactLeafletComponents | null {
  const [components, setComponents] = useState<ReactLeafletComponents | null>(null)

  useEffect(() => {
    let mounted = true
    import('react-leaflet').then((mod) => {
      if (mounted) {
        setComponents({
          MapContainer: mod.MapContainer,
          TileLayer: mod.TileLayer,
          Marker: mod.Marker,
        })
      }
    })
    return () => {
      mounted = false
    }
  }, [])

  return components
}

/**
 * Represents a location/hotel to display on the map.
 * @interface Location
 * @property {string} id - Unique identifier
 * @property {string} name - Location name
 * @property {string} [subtitle] - Subtitle (e.g., neighborhood)
 * @property {string} [image] - Location image URL
 * @property {number} [price] - Price value
 * @property {string} [priceLabel] - Full price text (e.g., "$284 total Jan 29 - Feb 1")
 * @property {string} [priceSubtext] - Additional price info (e.g., "USD • Includes taxes")
 * @property {number} [rating] - Rating value (e.g., 8.6)
 * @property {[number, number]} coordinates - Lat/lng coordinates
 * @property {string} [link] - External link URL
 */
export interface Location {
  id: string
  name: string
  subtitle?: string
  image?: string
  price?: number
  priceLabel?: string
  priceSubtext?: string
  rating?: number
  coordinates: [number, number] // [lat, lng]
  link?: string
}

/**
 * Available map tile styles.
 * @typedef {"voyager" | "voyager-smooth" | "positron" | "dark-matter" | "openstreetmap"} MapStyle
 */
export type MapStyle =
  | 'voyager'
  | 'voyager-smooth'
  | 'positron'
  | 'dark-matter'
  | 'openstreetmap'

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MapCarouselProps
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Props for configuring an interactive map with a horizontal carousel of
 * location cards. Clicking a marker or card selects that location.
 */
export interface MapCarouselProps {
  data?: {
    /** Array of locations to display on the map with price markers. */
    locations?: Location[]
    /**
     * Map center coordinates as [latitude, longitude].
     * @default [37.7899, -122.4034]
     */
    center?: [number, number]
    /**
     * Initial zoom level for the map.
     * @default 14
     */
    zoom?: number
    /**
     * Map tile style (voyager, positron, dark-matter, etc.).
     * @default "voyager"
     */
    mapStyle?: MapStyle
  }
  actions?: {
    /** Called when a user selects a location via marker or card click. */
    onSelectLocation?: (location: Location) => void
  }
  appearance?: {
    /**
     * Height of the map container.
     * @default "504px"
     */
    mapHeight?: string
  }
}

// Default San Francisco hotel data
const defaultLocations: Location[] = [
  {
    id: '1',
    name: 'FOUND Hotel Carlton, Nob Hill',
    subtitle: 'Downtown San Francisco',
    image:
      'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=200&h=200&fit=crop',
    price: 284,
    priceLabel: '$284 total Jan 29 - Feb 1',
    priceSubtext: 'USD • Includes taxes and fees',
    rating: 8.6,
    coordinates: [37.7879, -122.4137],
    link: ''
  },
  {
    id: '2',
    name: 'Hotel Nikko San Francisco',
    subtitle: 'Union Square',
    image:
      'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=200&h=200&fit=crop',
    price: 299,
    priceLabel: '$299 total Jan 29 - Feb 1',
    priceSubtext: 'USD • Includes taxes and fees',
    rating: 9.0,
    coordinates: [37.7856, -122.4104],
    link: ''
  },
  {
    id: '3',
    name: 'The Ritz-Carlton',
    subtitle: 'Nob Hill',
    image:
      'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=200&h=200&fit=crop',
    price: 527,
    priceLabel: '$527 total Jan 29 - Feb 1',
    priceSubtext: 'USD • Includes taxes and fees',
    rating: 9.4,
    coordinates: [37.7919, -122.4081],
    link: ''
  },
  {
    id: '4',
    name: 'Fairmont San Francisco',
    subtitle: 'Nob Hill',
    image:
      'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=200&h=200&fit=crop',
    price: 438,
    priceLabel: '$438 total Jan 29 - Feb 1',
    priceSubtext: 'USD • Includes taxes and fees',
    rating: 8.9,
    coordinates: [37.7923, -122.4102],
    link: ''
  },
  {
    id: '5',
    name: 'Hotel Vitale',
    subtitle: 'Embarcadero',
    image:
      'https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=200&h=200&fit=crop',
    price: 358,
    priceLabel: '$358 total Jan 29 - Feb 1',
    priceSubtext: 'USD • Includes taxes and fees',
    rating: 8.4,
    coordinates: [37.7935, -122.393],
    link: ''
  },
  {
    id: '6',
    name: 'Palace Hotel',
    subtitle: 'SoMa',
    image:
      'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=200&h=200&fit=crop',
    price: 308,
    priceLabel: '$308 total Jan 29 - Feb 1',
    priceSubtext: 'USD • Includes taxes and fees',
    rating: 8.7,
    coordinates: [37.787, -122.401],
    link: ''
  },
  {
    id: '7',
    name: 'Omni San Francisco',
    subtitle: 'Financial District',
    image:
      'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=200&h=200&fit=crop',
    price: 227,
    priceLabel: '$227 total Jan 29 - Feb 1',
    priceSubtext: 'USD • Includes taxes and fees',
    rating: 8.2,
    coordinates: [37.7942, -122.4028],
    link: ''
  },
  {
    id: '8',
    name: 'The Marker San Francisco',
    subtitle: 'Union Square',
    image:
      'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=200&h=200&fit=crop',
    price: 166,
    priceLabel: '$166 total Jan 29 - Feb 1',
    priceSubtext: 'USD • Includes taxes and fees',
    rating: 7.8,
    coordinates: [37.7875, -122.4089],
    link: ''
  }
]

// Hotel card component
function HotelCard({
  location,
  isSelected,
  onClick
}: {
  location: Location
  isSelected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative flex gap-3 p-2 rounded-xl border bg-card min-w-[300px] max-w-[300px] text-left transition-all shrink-0 cursor-pointer select-none shadow-[0_4px_20px_rgba(0,0,0,0.08)]',
        isSelected
          ? 'ring-1 ring-foreground border-foreground'
          : 'hover:border-foreground/30'
      )}
    >
      {/* Rating badge - top right */}
      {location.rating && (
        <div className="absolute top-2 right-2 bg-green-600 text-white text-[10px] font-bold rounded-md px-1.5 py-0.5">
          {location.rating}
        </div>
      )}

      {/* Image */}
      {location.image && (
        <div className="relative shrink-0">
          <img
            src={location.image}
            alt={location.name || 'Location image'}
            className="w-24 h-20 rounded-lg object-cover pointer-events-none"
            draggable={false}
          />
        </div>
      )}

      {/* Content */}
      <div className="flex flex-col justify-center min-w-0 flex-1 pointer-events-none">
        {location.name && (
          <h3 className="font-medium text-sm leading-tight truncate pr-8">
            {location.name}
          </h3>
        )}
        {location.subtitle && (
          <p className="text-xs text-muted-foreground truncate">
            {location.subtitle}
          </p>
        )}
        <div className="mt-1.5">
          {location.price !== undefined && (
            <p className="text-sm">
              <span className="font-semibold">${location.price} total</span>
              <span className="text-muted-foreground"> Jan 29 - Feb 1</span>
            </p>
          )}
          {location.priceSubtext && (
            <p className="text-[10px] text-muted-foreground">
              {location.priceSubtext}
            </p>
          )}
        </div>
      </div>
    </button>
  )
}

// Map placeholder shown during SSR or when Leaflet isn't loaded
function MapPlaceholder({ height }: { height: string }) {
  return (
    <div
      className="bg-muted/30 flex items-center justify-center"
      style={{ height }}
    >
      <div className="flex flex-col items-center gap-2 text-muted-foreground">
        <MapPin className="h-8 w-8" />
        <span className="text-sm">Loading map...</span>
      </div>
    </div>
  )
}

// Inner map component that uses Leaflet hooks
function MapWithMarkers({
  locations,
  selectedId,
  onSelectLocation,
  MarkerComponent
}: {
  locations: Location[]
  selectedId: string | null
  onSelectLocation: (location: Location) => void
  MarkerComponent: ComponentType<LeafletMarkerAttrs>
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

  return (
    <>
      {locations.map((location) => {
        const isSelected = selectedId === location.id
        const icon = L.divIcon({
          className: '',
          html: `<div style="
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            display: inline-block;
            padding: 4px 8px;
            border-radius: 8px;
            font-size: 12px;
            font-weight: 600;
            font-family: system-ui, -apple-system, sans-serif;
            white-space: nowrap;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.1);
            z-index: ${isSelected ? '1000' : '1'};
            ${
              isSelected
                ? 'background-color: #18181b; color: white;'
                : 'background-color: white; color: #18181b;'
            }
          ">${location.price !== undefined ? `$${location.price}` : location.name}</div>`,
          iconSize: [60, 24],
          iconAnchor: [30, 12]
        })

        return (
          <MarkerComponent
            key={location.id}
            position={location.coordinates}
            icon={icon}
            zIndexOffset={isSelected ? 1000 : 0}
            eventHandlers={{
              click: () => onSelectLocation(location)
            }}
          />
        )
      })}
    </>
  )
}

/**
 * Gets the tile configuration for a given map style.
 * @param {MapStyle} style - The map style to use
 * @returns {{ url: string; attribution: string }} The tile URL and attribution
 */
const getTileConfig = (style: MapStyle) => {
  const configs: Record<MapStyle, { url: string; attribution: string }> = {
    // Voyager - Colorful, detailed, Apple Maps-like (recommended default)
    voyager: {
      url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
    },
    // Voyager with labels under roads - cleaner look
    'voyager-smooth': {
      url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_labels_under/{z}/{x}/{y}{r}.png',
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
    },
    // Positron - Light, minimal, clean
    positron: {
      url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
    },
    // Dark Matter - Dark theme
    'dark-matter': {
      url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
    },
    // OpenStreetMap - Standard, detailed
    openstreetmap: {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }
  }
  return configs[style]
}

/**
 * An interactive map with a horizontal carousel of location cards.
 * Clicking a marker or card selects that location and syncs the view.
 *
 * Features:
 * - Leaflet map with multiple tile style options
 * - Price markers on map locations
 * - Draggable horizontal card carousel
 * - Location cards with image, rating, and price
 * - Selection sync between map and carousel
 * - Mobile touch support
 *
 * @component
 * @example
 * ```tsx
 * <MapCarousel
 *   data={{
 *     locations: [
 *       {
 *         id: "1",
 *         name: "Hotel Carlton",
 *         subtitle: "Downtown",
 *         image: "/hotel.jpg",
 *         price: 284,
 *         rating: 8.6,
 *         coordinates: [37.7879, -122.4137]
 *       }
 *     ],
 *     center: [37.7899, -122.4034],
 *     zoom: 14,
 *     mapStyle: "voyager"
 *   }}
 *   actions={{
 *     onSelectLocation: (loc) => console.log("Selected:", loc.name)
 *   }}
 *   appearance={{ mapHeight: "504px" }}
 * />
 * ```
 */
export function MapCarousel({ data, actions, appearance }: MapCarouselProps) {
  const {
    locations = defaultLocations,
    center = [37.7899, -122.4034], // San Francisco
    zoom = 14,
    mapStyle = 'voyager'
  } = data ?? {}

  const tileConfig = getTileConfig(mapStyle)
  const { onSelectLocation } = actions ?? {}
  const { mapHeight = '504px' } = appearance ?? {}

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [startX, setStartX] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)
  const [hasDragged, setHasDragged] = useState(false)
  const carouselRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<Map<string, HTMLButtonElement>>(new Map())

  // Lazy load react-leaflet components (React-only, no Next.js dependency)
  const leafletComponents = useReactLeaflet()

  // Handle location selection
  const handleSelectLocation = useCallback(
    (location: Location) => {
      setSelectedId(location.id)
      onSelectLocation?.(location)

      // Scroll to the selected card
      const cardElement = cardRefs.current.get(location.id)
      if (cardElement && carouselRef.current) {
        const container = carouselRef.current
        const cardLeft = cardElement.offsetLeft
        const cardWidth = cardElement.offsetWidth
        const containerWidth = container.offsetWidth
        const scrollTo = cardLeft - containerWidth / 2 + cardWidth / 2

        container.scrollTo({
          left: scrollTo,
          behavior: 'smooth'
        })
      }
    },
    [onSelectLocation]
  )

  // Drag handlers for carousel
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!carouselRef.current) return
    setIsDragging(true)
    setHasDragged(false)
    setStartX(e.pageX - carouselRef.current.offsetLeft)
    setScrollLeft(carouselRef.current.scrollLeft)
  }, [])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging || !carouselRef.current) return
      e.preventDefault()
      const x = e.pageX - carouselRef.current.offsetLeft
      const walk = (x - startX) * 1.5
      if (Math.abs(walk) > 5) {
        setHasDragged(true)
      }
      carouselRef.current.scrollLeft = scrollLeft - walk
    },
    [isDragging, startX, scrollLeft]
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleMouseLeave = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Touch handlers for mobile
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!carouselRef.current) return
    setIsDragging(true)
    setHasDragged(false)
    setStartX(e.touches[0].pageX - carouselRef.current.offsetLeft)
    setScrollLeft(carouselRef.current.scrollLeft)
  }, [])

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isDragging || !carouselRef.current) return
      const x = e.touches[0].pageX - carouselRef.current.offsetLeft
      const walk = (x - startX) * 1.5
      if (Math.abs(walk) > 5) {
        setHasDragged(true)
      }
      carouselRef.current.scrollLeft = scrollLeft - walk
    },
    [isDragging, startX, scrollLeft]
  )

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Handle card click (only if not dragging)
  const handleCardClick = useCallback(
    (location: Location) => {
      if (hasDragged) return
      handleSelectLocation(location)
      if (location.link) {
        window.open(location.link, '_blank', 'noopener,noreferrer')
      }
    },
    [hasDragged, handleSelectLocation]
  )

  return (
    <div
      className="relative w-full rounded-xl border bg-card overflow-hidden"
      style={{ height: mapHeight }}
    >
      {/* Map Section - Full size */}
      {leafletComponents ? (
        <leafletComponents.MapContainer
          center={center}
          zoom={zoom}
          style={{ height: '100%', width: '100%' }}
          zoomControl={true}
          scrollWheelZoom={true}
        >
          <leafletComponents.TileLayer
            attribution={tileConfig.attribution}
            url={tileConfig.url}
          />
          <MapWithMarkers
            locations={locations}
            selectedId={selectedId}
            onSelectLocation={handleSelectLocation}
            MarkerComponent={leafletComponents.Marker}
          />
        </leafletComponents.MapContainer>
      ) : (
        <MapPlaceholder height={mapHeight} />
      )}

      {/* Carousel Section - Overlay at bottom */}
      <div className="absolute bottom-0 left-0 right-0 z-[1000]">
        <div
          ref={carouselRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className={cn(
            'flex gap-3 p-3 overflow-x-auto scrollbar-hide',
            isDragging ? 'cursor-grabbing' : 'cursor-grab',
            'select-none'
          )}
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          {locations.map((location) => (
            <div
              key={location.id}
              ref={(el) => {
                if (el)
                  cardRefs.current.set(
                    location.id,
                    el as unknown as HTMLButtonElement
                  )
              }}
            >
              <HotelCard
                location={location}
                isSelected={selectedId === location.id}
                onClick={() => handleCardClick(location)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
