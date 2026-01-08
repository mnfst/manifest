'use client'

import { cn } from '@/lib/utils'
import { MapPin } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useCallback, useEffect, useRef, useState } from 'react'

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

// Location/Hotel data interface
export interface Location {
  id: string
  name: string
  subtitle?: string
  image: string
  price: number
  priceLabel?: string
  priceSubtext?: string
  rating?: number
  coordinates: [number, number] // [lat, lng]
  link?: string
}

export type MapStyle = 'positron' | 'dark-matter' | 'voyager' | 'jawg-lagoon' | 'jawg-dark' | 'jawg-streets'

export interface MapCarouselProps {
  data?: {
    locations?: Location[]
    center?: [number, number]
    zoom?: number
    mapStyle?: MapStyle
    jawgAccessToken?: string
  }
  actions?: {
    onSelectLocation?: (location: Location) => void
  }
  appearance?: {
    mapHeight?: string
  }
}

// Default San Francisco hotel data
const defaultLocations: Location[] = [
  {
    id: '1',
    name: 'FOUND Hotel Carlton, Nob Hill',
    subtitle: 'Downtown San Francisco',
    image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=200&h=200&fit=crop',
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
    image: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=200&h=200&fit=crop',
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
    image: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=200&h=200&fit=crop',
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
    image: 'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=200&h=200&fit=crop',
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
    image: 'https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=200&h=200&fit=crop',
    price: 358,
    priceLabel: '$358 total Jan 29 - Feb 1',
    priceSubtext: 'USD • Includes taxes and fees',
    rating: 8.4,
    coordinates: [37.7935, -122.3930],
    link: ''
  },
  {
    id: '6',
    name: 'Palace Hotel',
    subtitle: 'SoMa',
    image: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=200&h=200&fit=crop',
    price: 308,
    priceLabel: '$308 total Jan 29 - Feb 1',
    priceSubtext: 'USD • Includes taxes and fees',
    rating: 8.7,
    coordinates: [37.7870, -122.4010],
    link: ''
  },
  {
    id: '7',
    name: 'Omni San Francisco',
    subtitle: 'Financial District',
    image: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=200&h=200&fit=crop',
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
    image: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=200&h=200&fit=crop',
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
      <div className="relative shrink-0">
        <img
          src={location.image}
          alt={location.name}
          className="w-24 h-20 rounded-lg object-cover pointer-events-none"
          draggable={false}
        />
      </div>

      {/* Content */}
      <div className="flex flex-col justify-center min-w-0 flex-1 pointer-events-none">
        <h3 className="font-medium text-sm leading-tight truncate pr-8">{location.name}</h3>
        {location.subtitle && (
          <p className="text-xs text-muted-foreground truncate">{location.subtitle}</p>
        )}
        <div className="mt-1.5">
          <p className="text-sm">
            <span className="font-semibold">${location.price} total</span>
            <span className="text-muted-foreground"> Jan 29 - Feb 1</span>
          </p>
          {location.priceSubtext && (
            <p className="text-[10px] text-muted-foreground">{location.priceSubtext}</p>
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
  onSelectLocation
}: {
  locations: Location[]
  selectedId: string | null
  onSelectLocation: (location: Location) => void
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
            ${isSelected
              ? 'background-color: #18181b; color: white;'
              : 'background-color: white; color: #18181b;'}
          ">$${location.price}</div>`,
          iconSize: [60, 24],
          iconAnchor: [30, 12]
        })

        return (
          <Marker
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

const getTileConfig = (style: MapStyle, jawgToken?: string) => {
  const configs = {
    'positron': {
      url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
    },
    'dark-matter': {
      url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
    },
    'voyager': {
      url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
    },
    'jawg-lagoon': {
      url: `https://tile.jawg.io/jawg-lagoon/{z}/{x}/{y}{r}.png?access-token=${jawgToken}`,
      attribution: '<a href="https://jawg.io" target="_blank">&copy; Jawg</a> | <a href="https://www.openstreetmap.org/copyright">&copy; OpenStreetMap</a>'
    },
    'jawg-dark': {
      url: `https://tile.jawg.io/jawg-dark/{z}/{x}/{y}{r}.png?access-token=${jawgToken}`,
      attribution: '<a href="https://jawg.io" target="_blank">&copy; Jawg</a> | <a href="https://www.openstreetmap.org/copyright">&copy; OpenStreetMap</a>'
    },
    'jawg-streets': {
      url: `https://tile.jawg.io/jawg-streets/{z}/{x}/{y}{r}.png?access-token=${jawgToken}`,
      attribution: '<a href="https://jawg.io" target="_blank">&copy; Jawg</a> | <a href="https://www.openstreetmap.org/copyright">&copy; OpenStreetMap</a>'
    }
  }
  return configs[style]
}

export function MapCarousel({ data, actions, appearance }: MapCarouselProps) {
  const {
    locations = defaultLocations,
    center = [37.7899, -122.4034], // San Francisco
    zoom = 14,
    mapStyle = 'positron',
    jawgAccessToken
  } = data ?? {}

  const tileConfig = getTileConfig(mapStyle, jawgAccessToken)
  const { onSelectLocation } = actions ?? {}
  const { mapHeight = '504px' } = appearance ?? {}

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [startX, setStartX] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)
  const [hasDragged, setHasDragged] = useState(false)
  const carouselRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<Map<string, HTMLButtonElement>>(new Map())
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

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
    <div className="relative w-full rounded-xl border bg-card overflow-hidden" style={{ height: mapHeight }}>
      {/* Map Section - Full size */}
      {isMounted ? (
        <MapContainer
          center={center}
          zoom={zoom}
          style={{ height: '100%', width: '100%' }}
          zoomControl={true}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution={tileConfig.attribution}
            url={tileConfig.url}
          />
          <MapWithMarkers
            locations={locations}
            selectedId={selectedId}
            onSelectLocation={handleSelectLocation}
          />
        </MapContainer>
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
                if (el) cardRefs.current.set(location.id, el as unknown as HTMLButtonElement)
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
