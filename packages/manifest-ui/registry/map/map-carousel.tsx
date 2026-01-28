'use client'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { ChevronDown, MapPin, Maximize2, SlidersHorizontal, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { ComponentType } from 'react'

// =============================================================================
// Display Mode Types & Hook (inlined for distribution)
// =============================================================================

type DisplayMode = 'inline' | 'pip' | 'fullscreen'

function useOpenAIDisplayMode(): DisplayMode | undefined {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === 'undefined') return () => {}
      const handler = () => onChange()
      window.addEventListener('openai:set_globals', handler)
      return () => window.removeEventListener('openai:set_globals', handler)
    },
    () => (typeof window !== 'undefined' ? window.openai?.displayMode : undefined),
    () => undefined
  )
}

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
// Using any to avoid type mismatches between react-leaflet versions and @types/react
interface ReactLeafletComponents {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  MapContainer: ComponentType<any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TileLayer: ComponentType<any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Marker: ComponentType<any>
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
 * @property {string} [name] - Location name
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
  name?: string
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

// Filter state for fullscreen variant
interface FilterState {
  priceRanges: string[]
  ratings: string[]
  neighborhoods: string[]
}

const defaultFilters: FilterState = {
  priceRanges: [],
  ratings: [],
  neighborhoods: []
}

// Filter options
const priceRangeOptions = ['Under $200', '$200 - $300', '$300 - $400', '$400 - $500', '$500+']
const ratingOptions = ['9.0+', '8.0+', '7.0+', '6.0+']

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MapCarouselProps
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Props for configuring an interactive map with a horizontal carousel of
 * location cards. Clicking a marker or card selects that location.
 * Supports inline (map with carousel) and fullscreen (split-screen) modes.
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
    /** Optional title displayed above the list in fullscreen mode. */
    title?: string
  }
  actions?: {
    /** Called when a user selects a location via marker or card click. */
    onSelectLocation?: (location: Location) => void
    /** Called when the expand button is clicked (inline mode). */
    onExpand?: () => void
    /** Called when filters are applied (fullscreen mode). */
    onFiltersApply?: (filters: FilterState) => void
  }
  appearance?: {
    /**
     * Height of the map container (inline mode only).
     * @default "504px"
     */
    mapHeight?: string
    /**
     * Display mode for the component.
     * - inline: Map with carousel cards at bottom
     * - pip: Same as inline (compact view)
     * - fullscreen: Split-screen with cards on left, filters, map on right
     * @default "inline"
     */
    displayMode?: 'inline' | 'pip' | 'fullscreen'
  }
}

// Default San Francisco hotel data
const defaultLocations: Location[] = [
  {
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

// Location card for fullscreen list view
function LocationListCard({
  location,
  isSelected,
  onClick,
  onMouseEnter,
  onMouseLeave
}: {
  location: Location
  isSelected: boolean
  onClick: () => void
  onMouseEnter: () => void
  onMouseLeave: () => void
}) {
  return (
    <div
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={cn(
        'flex gap-3 p-3 border-b transition-colors cursor-pointer',
        isSelected && 'bg-accent'
      )}
    >
      {/* Thumbnail */}
      {location.image && (
        <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-md bg-muted">
          <img
            src={location.image}
            alt={location.name || 'Location image'}
            className="h-full w-full object-cover"
          />
        </div>
      )}
      {/* Location Info */}
      <div className="flex-1 min-w-0">
        {location.price !== undefined && (
          <p className="font-semibold text-sm">${location.price} total</p>
        )}
        {location.priceSubtext && (
          <p className="text-xs text-muted-foreground">{location.priceSubtext}</p>
        )}
        {location.name && (
          <p className="text-sm font-medium mt-1 line-clamp-1">{location.name}</p>
        )}
        {location.subtitle && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
            {location.subtitle}
          </p>
        )}
        {location.rating && (
          <div className="flex items-center gap-1 mt-1">
            <span className="bg-green-600 text-white text-[10px] font-bold rounded-md px-1.5 py-0.5">
              {location.rating}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// Filter section component with expandable checkbox list
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

// Filter panel that slides over the location list
function FilterPanel({
  isOpen,
  onClose,
  filters,
  onFiltersChange,
  onApply,
  onReset,
  resultCount,
  neighborhoodOptions
}: {
  isOpen: boolean
  onClose: () => void
  filters: FilterState
  onFiltersChange: (filters: FilterState) => void
  onApply: () => void
  onReset: () => void
  resultCount: number
  neighborhoodOptions: string[]
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
            title="Price Range"
            options={priceRangeOptions}
            selected={filters.priceRanges}
            onChange={(priceRanges) => onFiltersChange({ ...filters, priceRanges })}
          />
          <FilterSection
            title="Rating"
            options={ratingOptions}
            selected={filters.ratings}
            onChange={(ratings) => onFiltersChange({ ...filters, ratings })}
          />
          <FilterSection
            title="Neighborhood"
            options={neighborhoodOptions}
            selected={filters.neighborhoods}
            onChange={(neighborhoods) => onFiltersChange({ ...filters, neighborhoods })}
          />
        </div>

        {/* Footer with actions */}
        <div className="border-t px-4 py-3 space-y-2">
          <Button
            className="w-full"
            onClick={onApply}
          >
            Show {resultCount} locations
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

// Map placeholder shown during SSR or when Leaflet isn't loaded
function MapPlaceholder({ height }: { height?: string }) {
  return (
    <div
      className="bg-muted/30 flex items-center justify-center"
      style={{ height: height || '100%' }}
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
  selectedIndex,
  onSelectLocation,
  MarkerComponent
}: {
  locations: Location[]
  selectedIndex: number | null
  onSelectLocation: (location: Location, index: number) => void
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
      {locations.map((location, index) => {
        const isSelected = selectedIndex === index
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
          ">${location.price !== undefined ? `$${location.price}` : location.name ?? 'Location'}</div>`,
          iconSize: [60, 24],
          iconAnchor: [30, 12]
        })

        return (
          <MarkerComponent
            key={index}
            position={location.coordinates}
            icon={icon}
            zIndexOffset={isSelected ? 1000 : 0}
            eventHandlers={{
              click: () => onSelectLocation(location, index)
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
 * - Inline mode: Map with draggable carousel at bottom
 * - Fullscreen mode: Split-screen with cards on left, filters, map on right
 * - Location cards with image, rating, and price
 * - Selection sync between map and carousel/list
 * - ChatGPT display mode integration
 *
 * @component
 * @example
 * ```tsx
 * <MapCarousel
 *   data={{
 *     locations: [
 *       {
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
 *     mapStyle: "voyager",
 *     title: "Hotels in San Francisco"
 *   }}
 *   actions={{
 *     onSelectLocation: (loc) => console.log("Selected:", loc.name),
 *     onExpand: () => console.log("Expand to fullscreen")
 *   }}
 *   appearance={{
 *     mapHeight: "504px",
 *     displayMode: "inline"
 *   }}
 * />
 * ```
 */
export function MapCarousel({ data, actions, appearance }: MapCarouselProps) {
  const {
    locations = defaultLocations,
    center = [37.7899, -122.4034], // San Francisco
    zoom = 14,
    mapStyle = 'voyager',
    title
  } = data ?? {}

  const tileConfig = getTileConfig(mapStyle)
  const { onSelectLocation, onExpand, onFiltersApply } = actions ?? {}
  const { mapHeight = '504px' } = appearance ?? {}

  // Get display mode from host (ChatGPT/MCP) or fall back to appearance prop
  const hostDisplayMode = useOpenAIDisplayMode()
  const isRealHost =
    typeof window !== 'undefined' && window.openai && !('_isPreviewMock' in window.openai)
  const displayMode: DisplayMode = isRealHost && hostDisplayMode
    ? hostDisplayMode
    : (appearance?.displayMode ?? 'inline')

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [startX, setStartX] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)
  const [hasDragged, setHasDragged] = useState(false)
  const carouselRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<Map<number, HTMLButtonElement>>(new Map())

  // Filter state for fullscreen mode
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<FilterState>(defaultFilters)
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(defaultFilters)

  // Refs for fullscreen scroll functionality
  const listContainerRef = useRef<HTMLDivElement>(null)
  const locationItemRefs = useRef<Map<number, HTMLDivElement>>(new Map())

  // Lazy load react-leaflet components (React-only, no Next.js dependency)
  const leafletComponents = useReactLeaflet()

  // Get unique neighborhoods from locations for filter options
  const neighborhoodOptions = [...new Set(locations.map(l => l.subtitle).filter(Boolean) as string[])]

  // Filter locations based on applied filters
  const filterLocations = useCallback((locationsToFilter: Location[], filtersToApply: FilterState): Location[] => {
    return locationsToFilter.filter(location => {
      // Price range filter
      if (filtersToApply.priceRanges.length > 0) {
        const price = location.price ?? 0
        const priceMatch = filtersToApply.priceRanges.some(range => {
          if (range === 'Under $200') return price < 200
          if (range === '$200 - $300') return price >= 200 && price <= 300
          if (range === '$300 - $400') return price >= 300 && price <= 400
          if (range === '$400 - $500') return price >= 400 && price <= 500
          if (range === '$500+') return price >= 500
          return true
        })
        if (!priceMatch) return false
      }

      // Rating filter
      if (filtersToApply.ratings.length > 0) {
        const rating = location.rating ?? 0
        const ratingMatch = filtersToApply.ratings.some(ratingOption => {
          if (ratingOption === '9.0+') return rating >= 9.0
          if (ratingOption === '8.0+') return rating >= 8.0
          if (ratingOption === '7.0+') return rating >= 7.0
          if (ratingOption === '6.0+') return rating >= 6.0
          return true
        })
        if (!ratingMatch) return false
      }

      // Neighborhood filter
      if (filtersToApply.neighborhoods.length > 0) {
        if (!location.subtitle || !filtersToApply.neighborhoods.includes(location.subtitle)) {
          return false
        }
      }

      return true
    })
  }, [])

  // Scroll to location in list when selected from map
  const scrollToLocation = useCallback((locationIndex: number) => {
    const locationElement = locationItemRefs.current.get(locationIndex)
    if (locationElement && listContainerRef.current) {
      const container = listContainerRef.current
      const elementTop = locationElement.offsetTop
      const elementHeight = locationElement.offsetHeight
      const containerHeight = container.offsetHeight
      const scrollTo = elementTop - containerHeight / 2 + elementHeight / 2

      container.scrollTo({
        top: scrollTo,
        behavior: 'smooth'
      })
    }
  }, [])

  // Handle location selection
  const handleSelectLocation = useCallback(
    (location: Location, index: number) => {
      setSelectedIndex(index)
      onSelectLocation?.(location)

      // Scroll to the selected card (inline mode)
      const cardElement = cardRefs.current.get(index)
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

  // Handle expand button click
  const handleExpand = () => {
    // Request fullscreen from host if available
    if (typeof window !== 'undefined' && window.openai?.requestDisplayMode) {
      window.openai.requestDisplayMode({ mode: 'fullscreen' })
    }
    onExpand?.()
  }

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
    (location: Location, index: number) => {
      if (hasDragged) return
      handleSelectLocation(location, index)
      if (location.link) {
        window.open(location.link, '_blank', 'noopener,noreferrer')
      }
    },
    [hasDragged, handleSelectLocation]
  )

  // Fullscreen mode - split-screen with cards on left, map on right
  if (displayMode === 'fullscreen') {
    const handleLocationHover = (locationIndex: number | null) => {
      setSelectedIndex(locationIndex)
    }

    const handleLocationClick = (location: Location, index: number) => {
      setSelectedIndex(index)
      onSelectLocation?.(location)
      if (location.link) {
        window.open(location.link, '_blank', 'noopener,noreferrer')
      }
    }

    const handleMapMarkerClick = (location: Location, index: number) => {
      setSelectedIndex(index)
      scrollToLocation(index)
      onSelectLocation?.(location)
    }

    const handleFilterButtonClick = () => {
      setFilters(appliedFilters)
      setShowFilters(true)
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

    // Get filtered locations
    const filteredLocations = filterLocations(locations, appliedFilters)
    // Get preview count for filter panel
    const previewFilteredCount = filterLocations(locations, filters).length
    // Count of active filters
    const activeFiltersCount = Object.values(appliedFilters).flat().length

    return (
      <div className="flex w-full h-full min-h-[600px] bg-background">
        {/* Left Panel - Location List */}
        <div className="w-[380px] flex-shrink-0 border-r flex flex-col relative">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
            <div className="flex items-center gap-2 min-w-0">
              {title && <span className="font-semibold truncate">{title}</span>}
              <span className="text-muted-foreground text-xs whitespace-nowrap">| {filteredLocations.length}</span>
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

          {/* Scrollable Location List */}
          <div ref={listContainerRef} className="flex-1 overflow-y-auto">
            {filteredLocations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <p className="text-muted-foreground">No locations match your filters</p>
                <Button
                  variant="link"
                  className="mt-2"
                  onClick={handleResetFilters}
                >
                  Reset filters
                </Button>
              </div>
            ) : (
              filteredLocations.map((location, index) => (
                <div
                  key={index}
                  ref={(el) => {
                    if (el) locationItemRefs.current.set(index, el)
                  }}
                >
                  <LocationListCard
                    location={location}
                    isSelected={selectedIndex === index}
                    onClick={() => handleLocationClick(location, index)}
                    onMouseEnter={() => handleLocationHover(index)}
                    onMouseLeave={() => handleLocationHover(null)}
                  />
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
            neighborhoodOptions={neighborhoodOptions}
          />
        </div>

        {/* Right Panel - Map */}
        <div className="flex flex-1 min-w-0 relative">
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
                locations={filteredLocations}
                selectedIndex={selectedIndex}
                onSelectLocation={handleMapMarkerClick}
                MarkerComponent={leafletComponents.Marker}
              />
            </leafletComponents.MapContainer>
          ) : (
            <MapPlaceholder />
          )}
        </div>
      </div>
    )
  }

  // Inline and PiP modes - Map with carousel at bottom
  return (
    <div
      className="relative w-full rounded-xl border bg-card overflow-hidden"
      style={{ height: mapHeight }}
    >
      {/* Expand button in top right */}
      {onExpand && (
        <div className="absolute top-3 right-3 z-[1001]">
          <Button
            variant="secondary"
            size="icon"
            className="h-8 w-8 bg-background/90 backdrop-blur-sm shadow-md"
            onClick={handleExpand}
            aria-label="Expand to fullscreen"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      )}

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
            selectedIndex={selectedIndex}
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
          {locations.map((location, index) => (
            <div
              key={index}
              ref={(el) => {
                if (el)
                  cardRefs.current.set(
                    index,
                    el as unknown as HTMLButtonElement
                  )
              }}
            >
              <HotelCard
                location={location}
                isSelected={selectedIndex === index}
                onClick={() => handleCardClick(location, index)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
