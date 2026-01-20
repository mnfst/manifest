'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  MapPin,
  Star,
  Share2,
  Heart,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Car,
  Train,
  Bike,
  Footprints,
  Flag,
  BadgeCheck,
  Timer
} from 'lucide-react'
import { useState, useEffect } from 'react'
import type { ComponentType } from 'react'
import type { EventDetails, EventSignal } from './types'
import { demoEventDetails } from './demo/data'

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

// Format date for display
function formatEventDateTime(startDateTime: string, endDateTime?: string): string {
  const start = new Date(startDateTime)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate())

  const timeOptions: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit', hour12: true }
  const startTime = start.toLocaleTimeString('en-US', timeOptions)

  let datePrefix: string
  if (startDay.getTime() === today.getTime()) {
    datePrefix = 'Today'
  } else if (startDay.getTime() === tomorrow.getTime()) {
    datePrefix = 'Tomorrow'
  } else {
    datePrefix = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  if (endDateTime) {
    const end = new Date(endDateTime)
    const endTime = end.toLocaleTimeString('en-US', timeOptions)
    return `${datePrefix} · ${startTime} - ${endTime}`
  }

  return `${datePrefix} · ${startTime}`
}

// Format number with commas (consistent across server/client)
function formatNumber(num: number): string {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function EventSignalBadge({ signal }: { signal: EventSignal }) {
  const config: Record<EventSignal, { label: string; className: string }> = {
    'going-fast': { label: 'Going Fast', className: 'bg-orange-100 text-orange-700' },
    'popular': { label: 'Popular', className: 'bg-pink-100 text-pink-700' },
    'just-added': { label: 'Just Added', className: 'bg-blue-100 text-blue-700' },
    'sales-end-soon': { label: 'Sales end soon', className: 'bg-red-100 text-red-700' },
    'few-tickets-left': { label: 'Few Tickets Left', className: 'bg-orange-100 text-orange-700' },
    'canceled': { label: 'Canceled', className: 'bg-gray-100 text-gray-700' },
    'ended': { label: 'Ended', className: 'bg-gray-100 text-gray-700' },
    'postponed': { label: 'Postponed', className: 'bg-yellow-100 text-yellow-700' }
  }

  const { label, className } = config[signal]
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium', className)}>
      {label}
    </span>
  )
}

// Map placeholder shown during SSR or when Leaflet isn't loaded
function MapPlaceholder() {
  return (
    <div className="flex h-full items-center justify-center bg-muted/30">
      <div className="flex flex-col items-center gap-2 text-muted-foreground">
        <MapPin className="h-8 w-8" />
        <span className="text-sm">Loading map...</span>
      </div>
    </div>
  )
}

// Venue marker component that uses Leaflet
function VenueMapMarker({
  coordinates,
  venueName,
  MarkerComponent
}: {
  coordinates: { lat: number; lng: number }
  venueName: string
  MarkerComponent: ComponentType<LeafletMarkerAttrs>
}) {
  const [L, setL] = useState<typeof import('leaflet') | null>(null)

  useEffect(() => {
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

  const icon = L.divIcon({
    className: '',
    html: `<div style="
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -100%);
      display: flex;
      flex-direction: column;
      align-items: center;
    ">
      <div style="
        background-color: #18181b;
        color: white;
        padding: 6px 10px;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 600;
        font-family: system-ui, -apple-system, sans-serif;
        white-space: nowrap;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      ">${venueName}</div>
      <div style="
        width: 0;
        height: 0;
        border-left: 8px solid transparent;
        border-right: 8px solid transparent;
        border-top: 8px solid #18181b;
        margin-top: -1px;
      "></div>
    </div>`,
    iconSize: [100, 40],
    iconAnchor: [50, 40]
  })

  return (
    <MarkerComponent
      position={[coordinates.lat, coordinates.lng]}
      icon={icon}
    />
  )
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EventDetailProps
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Props for the EventDetail component. Displays comprehensive event information
 * including image carousel, location map, organizer details, and ticket actions.
 */
export interface EventDetailProps {
  data?: {
    /** The full event details object to display. */
    event?: EventDetails
  }
  actions?: {
    /** Called when "Get tickets" button is clicked. */
    onGetTickets?: (event: EventDetails) => void
    /** Called when share button is clicked. */
    onShare?: (event: EventDetails) => void
    /** Called when save/heart button is clicked. */
    onSave?: (event: EventDetails) => void
    /** Called when back navigation button is clicked. */
    onBack?: () => void
    /** Called when "Follow" organizer button is clicked. */
    onFollow?: (organizer: EventDetails['organizer']) => void
    /** Called when "Contact" organizer button is clicked. */
    onContact?: (organizer: EventDetails['organizer']) => void
  }
  appearance?: {
    /**
     * Whether to show the AI match explanation section.
     * @default true
     */
    showAiMatch?: boolean
    /**
     * Whether to show the interactive map.
     * @default true
     */
    showMap?: boolean
  }
}

export function EventDetail({ data, actions, appearance }: EventDetailProps) {
  const { event = demoEventDetails } = data ?? {}
  const { onGetTickets, onShare, onSave, onBack, onFollow, onContact } = actions ?? {}
  const { showAiMatch = true, showMap = true } = appearance ?? {}

  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [isSaved, setIsSaved] = useState(false)

  // Lazy load react-leaflet components (React-only, no Next.js dependency)
  const leafletComponents = useReactLeaflet()

  const images = event.images?.length ? event.images : (event.image ? [event.image] : [])

  const handlePrevImage = () => {
    setCurrentImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1))
  }

  const handleNextImage = () => {
    setCurrentImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1))
  }

  const handleSave = () => {
    setIsSaved(!isSaved)
    onSave?.(event)
  }

  return (
    <div className="mx-auto max-w-lg bg-background">
      {/* Image Carousel */}
      {images.length > 0 && (
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          <img
            src={images[currentImageIndex]}
            alt={event.title}
            className="h-full w-full object-cover"
          />

          {/* Navigation overlay */}
          <div className="absolute inset-0 flex items-center justify-between p-2">
            {images.length > 1 && (
              <>
                <button
                  onClick={handlePrevImage}
                  aria-label="Previous image"
                  className="rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  onClick={handleNextImage}
                  aria-label="Next image"
                  className="rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            )}
          </div>

          {/* Top actions */}
          <div className="absolute top-3 right-3 flex gap-2">
            <button
              onClick={() => onShare?.(event)}
              aria-label="Share event"
              className="rounded-full bg-white/90 p-2 shadow-sm hover:bg-white"
            >
              <Share2 className="h-5 w-5" />
            </button>
            <button
              onClick={handleSave}
              aria-label={isSaved ? 'Remove from saved' : 'Save event'}
              className="rounded-full bg-white/90 p-2 shadow-sm hover:bg-white"
            >
              <Heart className={cn('h-5 w-5', isSaved && 'fill-red-500 text-red-500')} />
            </button>
          </div>

          {/* Back button */}
          {onBack && (
            <button
              onClick={onBack}
              aria-label="Go back"
              className="absolute top-3 left-3 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}

          {/* Image counter */}
          {images.length > 1 && (
            <div className="absolute bottom-3 right-3 rounded-full bg-black/60 px-2.5 py-1 text-xs text-white">
              {currentImageIndex + 1} / {images.length}
            </div>
          )}
        </div>
      )}

      <div className="space-y-6 p-4">
        {/* Signal Badge */}
        {event.eventSignal && (
          <div>
            <EventSignalBadge signal={event.eventSignal} />
          </div>
        )}

        {/* Category */}
        <span className="inline-block rounded-full bg-muted px-3 py-1 text-sm font-medium">
          {event.category}
        </span>

        {/* Title */}
        <h1 className="text-2xl font-bold leading-tight">{event.title}</h1>

        {/* Organizer + Rating */}
        {event.organizer && (
          <div className="flex items-center gap-2 text-sm">
            {event.organizer.verified && (
              <BadgeCheck className="h-4 w-4 text-blue-500" />
            )}
            <span className="font-medium">{event.organizer.name}</span>
            <span className="text-muted-foreground">·</span>
            <span className="flex items-center gap-1">
              <Star className="h-4 w-4 fill-current text-yellow-500" />
              {event.organizer.rating} ({formatNumber(event.organizer.reviewCount)})
            </span>
          </div>
        )}

        {/* Venue + Location */}
        <div className="flex items-start gap-2 text-sm text-muted-foreground">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {event.venue_details?.name || event.venue} · {event.city}
            {event.neighborhood && ` (${event.neighborhood})`}
          </span>
        </div>

        {/* Price + Attendees */}
        <div className="flex items-center gap-4">
          <div>
            <div className="text-lg font-semibold">{event.priceRange}</div>
          </div>
          {event.attendeesCount && (
            <div className="flex items-center gap-2">
              {event.friendsGoing && event.friendsGoing.length > 0 && (
                <div className="flex -space-x-2">
                  {event.friendsGoing.slice(0, 3).map((friend, i) => (
                    <img
                      key={i}
                      src={friend.avatar}
                      alt={friend.name}
                      className="h-6 w-6 rounded-full border-2 border-background"
                    />
                  ))}
                </div>
              )}
              <span className="text-sm text-muted-foreground">
                {event.friendsGoing && event.friendsGoing.length > 0 && `+ ${event.friendsGoing.length} friends · `}
                {event.attendeesCount} going
              </span>
            </div>
          )}
        </div>

        {/* Vibe Tags */}
        {event.vibeTags && event.vibeTags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {event.vibeTags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border px-3 py-1 text-sm"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* CTA Buttons */}
        <div className="flex gap-3">
          <Button
            className="flex-1 bg-primary hover:bg-primary/90"
            onClick={() => onGetTickets?.(event)}
          >
            Get tickets
          </Button>
          <Button variant="outline" className="flex-1">
            Invite friends
          </Button>
        </div>

        {/* AI Match */}
        {showAiMatch && event.aiSummary && (
          <div className="rounded-lg bg-muted/50 p-4">
            <h3 className="font-semibold">Why this matches your vibe</h3>
            <p className="mt-1 text-sm text-muted-foreground">{event.aiSummary}</p>
          </div>
        )}

        {/* About */}
        {event.description && (
          <div>
            <h2 className="text-lg font-semibold">About</h2>
            <p className="mt-2 text-sm text-muted-foreground">{event.description}</p>
          </div>
        )}

        {/* Lineup */}
        {event.lineup && event.lineup.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-muted-foreground">Lineup</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {event.lineup.map((artist) => (
                <span key={artist} className="rounded-full border px-3 py-1 text-sm">
                  {artist}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Good to Know */}
        {event.goodToKnow && (
          <div>
            <h2 className="text-lg font-semibold">Good to know</h2>
            <div className="mt-3 grid grid-cols-2 gap-4">
              <div className="rounded-lg bg-muted/50 p-3">
                <h4 className="text-sm font-medium">Highlights</h4>
                <div className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                  {event.goodToKnow.duration && (
                    <div className="flex items-center gap-2">
                      <Timer className="h-4 w-4" />
                      {event.goodToKnow.duration}
                    </div>
                  )}
                  {event.locationType !== 'online' && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      In person
                    </div>
                  )}
                </div>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <h4 className="text-sm font-medium">Refund Policy</h4>
                <p className="mt-2 text-sm text-muted-foreground">
                  {event.policies?.refund || 'No refunds'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Location */}
        {event.venue_details && (
          <div>
            <h2 className="text-lg font-semibold">Location</h2>
            <div className="mt-3">
              <p className="font-medium">{event.venue_details.name}</p>
              <p className="text-sm text-muted-foreground">{event.venue_details.address}</p>
              <p className="text-sm text-muted-foreground">{event.venue_details.city}</p>
            </div>

            {showMap && event.venue_details.coordinates && (
              <div className="mt-4 aspect-video overflow-hidden rounded-lg bg-muted">
                {leafletComponents ? (
                  <leafletComponents.MapContainer
                    center={[event.venue_details.coordinates.lat, event.venue_details.coordinates.lng]}
                    zoom={15}
                    style={{ height: '100%', width: '100%' }}
                    zoomControl={true}
                    scrollWheelZoom={false}
                  >
                    <leafletComponents.TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
                      url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                    />
                    <VenueMapMarker
                      coordinates={event.venue_details.coordinates}
                      venueName={event.venue_details.name}
                      MarkerComponent={leafletComponents.Marker}
                    />
                  </leafletComponents.MapContainer>
                ) : (
                  <MapPlaceholder />
                )}
              </div>
            )}

            <div className="mt-4">
              <p className="text-sm font-medium">How do you want to get there?</p>
              <div className="mt-2 space-y-2">
                {[
                  { icon: Car, label: 'Driving' },
                  { icon: Train, label: 'Public transport' },
                  { icon: Bike, label: 'Biking' },
                  { icon: Footprints, label: 'Walking' }
                ].map(({ icon: Icon, label }) => (
                  <button key={label} className="flex w-full items-center gap-3 rounded-lg p-2 hover:bg-muted">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Organizer */}
        {event.organizer && (
          <div>
            <h2 className="text-lg font-semibold">Organized by</h2>
            <div className="mt-3 rounded-lg border p-4">
              <div className="flex items-center gap-3">
                {event.organizer.image ? (
                  <img
                    src={event.organizer.image}
                    alt={event.organizer.name}
                    className="h-12 w-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-lg font-medium">
                    {event.organizer.name.charAt(0)}
                  </div>
                )}
                <div className="flex-1">
                  <p className="font-medium">{event.organizer.name}</p>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>Followers<br /><strong>{event.organizer.followers ? formatNumber(event.organizer.followers) : '--'}</strong></span>
                    <span>Events<br /><strong>{event.organizer.eventsCount || '--'}</strong></span>
                    <span>Hosting<br /><strong>{event.organizer.hostingYears ? `${event.organizer.hostingYears} yrs` : '--'}</strong></span>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => onContact?.(event.organizer)}>
                  Contact
                </Button>
                <Button size="sm" className="flex-1 bg-primary hover:bg-primary/90" onClick={() => onFollow?.(event.organizer)}>
                  Follow
                </Button>
              </div>
              {(event.organizer.trackRecord || event.organizer.responseRate) && (
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  {event.organizer.trackRecord === 'great' && (
                    <span className="flex items-center gap-1 text-green-600">
                      <CheckCircle className="h-3 w-3" /> Great track record
                    </span>
                  )}
                  {event.organizer.responseRate === 'very responsive' && (
                    <span className="flex items-center gap-1 text-orange-600">
                      <CheckCircle className="h-3 w-3" /> Very responsive
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Policies & Info */}
        {event.policies && (
          <div>
            <h2 className="text-lg font-semibold">Policies & Info</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {event.goodToKnow?.ageRestriction && (
                <span className="rounded-full border px-3 py-1 text-sm">{event.goodToKnow.ageRestriction}</span>
              )}
              {event.policies.idRequired && (
                <span className="rounded-full border px-3 py-1 text-sm">ID checks</span>
              )}
              {event.policies.securityOnSite && (
                <span className="rounded-full border px-3 py-1 text-sm">Security on site</span>
              )}
            </div>
          </div>
        )}

        {/* FAQs */}
        {event.faq && event.faq.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold">FAQs</h2>
            <div className="mt-3 space-y-2">
              {event.faq.map((item, index) => (
                <div key={index} className="text-sm">
                  <p><strong>{item.question.replace('?', '')}:</strong> {item.answer}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Report */}
        <button className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
          <Flag className="h-4 w-4" />
          Report this event
        </button>

        {/* Related Tags */}
        {event.relatedTags && event.relatedTags.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold">Related to this event</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {event.relatedTags.map((tag) => (
                <span key={tag} className="rounded-full border px-3 py-1 text-sm hover:bg-muted cursor-pointer">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Bottom CTA */}
        <div className="mt-6 rounded-lg border bg-muted/30 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold">{event.priceRange}</p>
              <p className="text-sm text-muted-foreground">{formatEventDateTime(event.startDateTime, event.endDateTime)}</p>
            </div>
            <Button
              className="bg-primary hover:bg-primary/90"
              onClick={() => onGetTickets?.(event)}
            >
              Get tickets
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
