'use client'

import {
  CalendarX,
  CirclePause,
  Clock,
  Flame,
  MapPin,
  Sparkles,
  Star,
  Ticket,
  Timer,
  TrendingUp,
  XCircle
} from 'lucide-react'
import type { Event, EventSignal } from './types'
import { demoEvent } from './demo/events'

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EventCardProps
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Props for the EventCard component. Displays event information with multiple
 * layout variants, signal badges, vibe tags, and organizer ratings.
 */
export interface EventCardProps {
  data?: {
    /** The event object to display. */
    event?: Event
  }
  actions?: {
    /** Called when the card is clicked. */
    onClick?: (event: Event) => void
  }
  appearance?: {
    /**
     * Card layout variant.
     * @default "default"
     */
    variant?: 'default' | 'compact' | 'horizontal' | 'covered'
    /**
     * Whether to show the event signal badge.
     * @default true
     */
    showSignal?: boolean
    /**
     * Whether to show vibe tags.
     * @default true
     */
    showTags?: boolean
    /**
     * Whether to show the organizer rating.
     * @default true
     */
    showRating?: boolean
  }
}

function EventSignalBadge({ signal }: { signal: EventSignal }) {
  const config: Record<
    EventSignal,
    { label: string; icon: typeof Flame; className: string }
  > = {
    'going-fast': {
      label: 'Going Fast',
      icon: Flame,
      className: 'bg-orange-500/10 text-orange-600 border-orange-200'
    },
    popular: {
      label: 'Popular',
      icon: TrendingUp,
      className: 'bg-pink-500/10 text-pink-600 border-pink-200'
    },
    'just-added': {
      label: 'Just Added',
      icon: Sparkles,
      className: 'bg-blue-500/10 text-blue-600 border-blue-200'
    },
    'sales-end-soon': {
      label: 'Sales End Soon',
      icon: Timer,
      className: 'bg-red-500/10 text-red-600 border-red-200'
    },
    'few-tickets-left': {
      label: 'Few Tickets Left',
      icon: Ticket,
      className: 'bg-orange-500/10 text-orange-600 border-orange-200'
    },
    canceled: {
      label: 'Canceled',
      icon: XCircle,
      className: 'bg-gray-500/10 text-gray-600 border-gray-200'
    },
    ended: {
      label: 'Ended',
      icon: CalendarX,
      className: 'bg-gray-500/10 text-gray-600 border-gray-200'
    },
    postponed: {
      label: 'Postponed',
      icon: CirclePause,
      className: 'bg-yellow-500/10 text-yellow-600 border-yellow-200'
    }
  }

  const { label, icon: Icon, className } = config[signal]

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${className}`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  )
}

// Format number with commas (consistent across server/client)
function formatNumber(num: number): string {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/**
 * An event card component with multiple layout variants.
 * Displays event information with signals, tags, and ratings.
 *
 * Features:
 * - Four layout variants (default, compact, horizontal, covered)
 * - Event signal badges (going fast, popular, etc.)
 * - Vibe tags display
 * - Organizer rating display
 * - Clickable card interaction
 *
 * @component
 * @example
 * ```tsx
 * <EventCard
 *   data={{
 *     event: {
 *       title: "Concert Night",
 *       category: "Music",
 *       dateTime: "Sat, Jan 20 · 8pm",
 *       venue: "The Fillmore",
 *       priceRange: "$45 - $150"
 *     }
 *   }}
 *   appearance={{ variant: "default", showSignal: true }}
 *   actions={{ onClick: (event) => console.log("Clicked:", event.title) }}
 * />
 * ```
 */
export function EventCard({ data, actions, appearance }: EventCardProps) {
  const resolved: NonNullable<EventCardProps['data']> = data ?? { event: demoEvent }
  const event = resolved.event
  const onClick = actions?.onClick
  const variant = appearance?.variant ?? 'default'
  const showSignal = appearance?.showSignal ?? true
  const showTags = appearance?.showTags ?? true
  const showRating = appearance?.showRating ?? true

  if (!event) {
    return null
  }

  const handleClick = () => {
    if (onClick) {
      onClick(event)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleClick()
    }
  }

  const cardAriaLabel = [
    event.title,
    event.category && `${event.category} event`,
    event.venue && `at ${event.venue}`,
    event.dateTime,
    event.priceRange
  ].filter(Boolean).join(', ')

  if (variant === 'covered') {
    return (
      <div
        role="button"
        tabIndex={0}
        aria-label={cardAriaLabel}
        className="relative overflow-hidden rounded-lg border cursor-pointer min-h-[280px]"
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      >
        {/* Background image */}
        {event.image && (
          <img
            src={event.image}
            alt={event.title}
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />
        <div className="absolute inset-0 flex flex-col justify-end p-4 text-white">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              {event.category && (
                <p className="text-[10px] font-medium uppercase tracking-wide text-white/70">
                  {event.category}
                </p>
              )}
              {showSignal && event.eventSignal && (
                <EventSignalBadge signal={event.eventSignal} />
              )}
            </div>
            {event.title && (
              <h2 className="mt-1 text-lg font-semibold leading-tight">
                {event.title}
              </h2>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/80">
              {event.dateTime && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {event.dateTime}
                </span>
              )}
              {event.venue && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {event.venue}
                  {event.neighborhood && `, ${event.neighborhood}`}
                </span>
              )}
            </div>
            {showTags && event.vibeTags && event.vibeTags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {event.vibeTags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md bg-white/20 px-2 py-0.5 text-xs"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <div className="mt-3 flex items-center gap-3">
              {event.priceRange && <span className="font-semibold">{event.priceRange}</span>}
              {showRating && event.organizerRating && (
                <span className="flex items-center gap-1 text-sm text-white/70">
                  <Star className="h-3.5 w-3.5 fill-current text-yellow-400" />
                  {event.organizerRating}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (variant === 'horizontal') {
    return (
      <div
        role="button"
        tabIndex={0}
        aria-label={cardAriaLabel}
        className="flex gap-4 rounded-xl border bg-card p-4 cursor-pointer hover:bg-accent/50 transition-colors"
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      >
        {/* Image */}
        {event.image && (
          <div className="h-[140px] w-[180px] flex-shrink-0 overflow-hidden rounded-lg bg-muted">
            <img
              src={event.image}
              alt={event.title || 'Event image'}
              className="h-full w-full object-cover"
            />
          </div>
        )}
        <div className="flex flex-1 flex-col justify-between">
          <div>
            {showSignal && event.eventSignal && (
              <div className="mb-1.5">
                <EventSignalBadge signal={event.eventSignal} />
              </div>
            )}
            {event.title && (
              <h3 className="line-clamp-2 text-base font-semibold leading-tight">
                {event.title}
              </h3>
            )}
            <div className="mt-2 space-y-1 text-sm text-muted-foreground">
              {event.dateTime && <p>{event.dateTime}</p>}
              {(event.city || event.venue) && (
                <p>
                  {event.city}
                  {event.city && event.venue && ' · '}
                  {event.venue}
                </p>
              )}
            </div>
          </div>
          <div className="mt-3">
            {event.priceRange && <span className="font-semibold">{event.priceRange}</span>}
          </div>
        </div>
      </div>
    )
  }

  if (variant === 'compact') {
    return (
      <div
        role="button"
        tabIndex={0}
        aria-label={cardAriaLabel}
        className="flex h-full flex-col overflow-hidden rounded-lg border bg-card cursor-pointer hover:bg-accent/50 transition-colors"
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      >
        {/* Image */}
        {event.image && (
          <div className="aspect-[16/9] overflow-hidden bg-muted">
            <img
              src={event.image}
              alt={event.title || 'Event image'}
              className="h-full w-full object-cover"
            />
          </div>
        )}
        <div className="flex flex-1 flex-col justify-between p-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              {event.category && (
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {event.category}
                </p>
              )}
              {showSignal && event.eventSignal && (
                <EventSignalBadge signal={event.eventSignal} />
              )}
            </div>
            {event.title && (
              <h3 className="line-clamp-2 text-sm font-medium">{event.title}</h3>
            )}
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
              {event.dateTime && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {event.dateTime}
                </span>
              )}
              {event.venue && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {event.venue}
                </span>
              )}
            </div>
            {showTags && event.vibeTags && event.vibeTags.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {event.vibeTags.slice(0, 2).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="mt-3 flex items-center gap-2">
            {event.priceRange && <span className="text-sm font-medium">{event.priceRange}</span>}
            {showRating && event.organizerRating && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Star className="h-3 w-3 fill-current text-yellow-500" />
                {event.organizerRating}
              </span>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Default variant
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={cardAriaLabel}
      className="flex h-full flex-col overflow-hidden rounded-lg border bg-card cursor-pointer hover:bg-accent/50 transition-colors"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {/* Image */}
      {event.image && (
        <div className="aspect-[16/9] overflow-hidden bg-muted">
          <img
            src={event.image}
            alt={event.title || 'Event image'}
            className="h-full w-full object-cover"
          />
        </div>
      )}
      <div className="flex flex-1 flex-col justify-between p-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {event.category && (
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {event.category}
              </p>
            )}
            {showSignal && event.eventSignal && (
              <EventSignalBadge signal={event.eventSignal} />
            )}
          </div>
          {event.title && (
            <h3 className="line-clamp-2 font-medium">{event.title}</h3>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            {event.dateTime && (
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {event.dateTime}
              </span>
            )}
            {event.venue && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {event.venue}
                {event.neighborhood && `, ${event.neighborhood}`}
              </span>
            )}
          </div>
          {showTags && event.vibeTags && event.vibeTags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {event.vibeTags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="mt-4 flex items-center gap-3">
          {event.priceRange && <span className="font-medium">{event.priceRange}</span>}
          {showRating && event.organizerRating && (
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <Star className="h-3.5 w-3.5 fill-current text-yellow-500" />
              {event.organizerRating}
              {event.reviewCount && (
                <span className="text-xs">
                  ({formatNumber(event.reviewCount)})
                </span>
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
