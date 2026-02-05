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
import { Suspense, useState } from 'react'
import type { EventDetails } from './types'
import {
  LazyLeafletMap,
  formatNumber,
  MapPlaceholder,
  EventSignalBadge
} from './shared'
import { demoEventDetails } from './demo/events'

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
  const resolved: NonNullable<EventDetailProps['data']> = data ?? { event: demoEventDetails }
  const event = resolved.event
  const onGetTickets = actions?.onGetTickets
  const onShare = actions?.onShare
  const onSave = actions?.onSave
  const onBack = actions?.onBack
  const onFollow = actions?.onFollow
  const onContact = actions?.onContact
  const showAiMatch = appearance?.showAiMatch ?? true
  const showMap = appearance?.showMap ?? true

  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [isSaved, setIsSaved] = useState(false)

  if (!event) {
    return null
  }

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
            alt={event.title || 'Event image'}
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
        {event.category && (
          <span className="inline-block rounded-full bg-muted px-3 py-1 text-sm font-medium">
            {event.category}
          </span>
        )}

        {/* Title */}
        {event.title && (
          <h1 className="text-2xl font-bold leading-tight">{event.title}</h1>
        )}

        {/* Organizer + Rating */}
        {event.organizer && (
          <div className="flex items-center gap-2 text-sm">
            {event.organizer.verified && (
              <BadgeCheck className="h-4 w-4 text-blue-500" />
            )}
            {event.organizer.name && (
              <span className="font-medium">{event.organizer.name}</span>
            )}
            {(event.organizer.rating !== undefined || event.organizer.reviewCount !== undefined) && (
              <>
                <span className="text-muted-foreground">·</span>
                <span className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-current text-yellow-500" />
                  {event.organizer.rating !== undefined && event.organizer.rating}
                  {event.organizer.reviewCount !== undefined && ` (${formatNumber(event.organizer.reviewCount)})`}
                </span>
              </>
            )}
          </div>
        )}

        {/* Venue + Location */}
        {(event.venue_details?.name || event.venue || event.city) && (
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {[event.venue_details?.name || event.venue, event.city].filter(Boolean).join(' · ')}
              {event.neighborhood && ` (${event.neighborhood})`}
            </span>
          </div>
        )}

        {/* Price + Attendees */}
        <div className="flex items-center gap-4">
          {event.priceRange && (
            <div>
              <div className="text-lg font-semibold">{event.priceRange}</div>
            </div>
          )}
          {event.attendeesCount !== undefined && (
            <div className="flex items-center gap-2">
              {event.friendsGoing && event.friendsGoing.length > 0 && (
                <div className="flex -space-x-2">
                  {event.friendsGoing.slice(0, 3).map((friend) => (
                    friend.avatar && (
                      <img
                        key={friend.name || friend.avatar}
                        src={friend.avatar}
                        alt={friend.name || 'Friend'}
                        className="h-6 w-6 rounded-full border-2 border-background"
                      />
                    )
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
              {event.policies?.refund && (
                <div className="rounded-lg bg-muted/50 p-3">
                  <h4 className="text-sm font-medium">Refund Policy</h4>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {event.policies.refund}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Location */}
        {event.venue_details && (
          <div>
            <h2 className="text-lg font-semibold">Location</h2>
            <div className="mt-3">
              {event.venue_details.name && (
                <p className="font-medium">{event.venue_details.name}</p>
              )}
              {event.venue_details.address && (
                <p className="text-sm text-muted-foreground">{event.venue_details.address}</p>
              )}
              {event.venue_details.city && (
                <p className="text-sm text-muted-foreground">{event.venue_details.city}</p>
              )}
            </div>

            {showMap && event.venue_details.coordinates && (
              <div className="mt-4 aspect-video overflow-hidden rounded-lg bg-muted">
                <Suspense fallback={<MapPlaceholder />}>
                  <LazyLeafletMap
                    center={[event.venue_details.coordinates.lat, event.venue_details.coordinates.lng]}
                    zoom={15}
                    scrollWheelZoom={false}
                    renderMarkers={({ Marker, L }) => {
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
                          ">${event.venue_details!.name}</div>
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
                        <Marker
                          position={[event.venue_details!.coordinates!.lat, event.venue_details!.coordinates!.lng]}
                          icon={icon}
                        />
                      )
                    }}
                  />
                </Suspense>
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
                    alt={event.organizer.name || 'Organizer'}
                    className="h-12 w-12 rounded-full object-cover"
                  />
                ) : event.organizer.name ? (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-lg font-medium">
                    {event.organizer.name.charAt(0)}
                  </div>
                ) : null}
                <div className="flex-1">
                  {event.organizer.name && (
                    <p className="font-medium">{event.organizer.name}</p>
                  )}
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    {event.organizer.followers !== undefined && (
                      <span>Followers<br /><strong>{formatNumber(event.organizer.followers)}</strong></span>
                    )}
                    {event.organizer.eventsCount !== undefined && (
                      <span>Events<br /><strong>{event.organizer.eventsCount}</strong></span>
                    )}
                    {event.organizer.hostingYears !== undefined && (
                      <span>Hosting<br /><strong>{event.organizer.hostingYears} yrs</strong></span>
                    )}
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
              {event.faq.map((item) => (
                <div key={item.question} className="text-sm">
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
              {event.priceRange && <p className="font-semibold">{event.priceRange}</p>}
              {event.startDateTime && <p className="text-sm text-muted-foreground">{formatEventDateTime(event.startDateTime, event.endDateTime)}</p>}
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
