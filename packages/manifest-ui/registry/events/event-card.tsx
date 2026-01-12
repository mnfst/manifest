'use client'

import { Button } from '@/components/ui/button'
import { MapPin, Clock, Star, Flame, TrendingUp, Sparkles, Timer, Ticket, XCircle, CirclePause, CalendarX, Video } from 'lucide-react'
import type { Event } from './types'

// Import shared OpenAI types
import '@/lib/openai-types'

// Format date for display (e.g., "Tonight 9:00 PM - 3:00 AM", "Tomorrow 8:00 PM", "Jan 15 • 7:00 PM")
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
    datePrefix = 'Tonight'
  } else if (startDay.getTime() === tomorrow.getTime()) {
    datePrefix = 'Tomorrow'
  } else {
    datePrefix = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  if (endDateTime) {
    const end = new Date(endDateTime)
    const endTime = end.toLocaleTimeString('en-US', timeOptions)
    return `${datePrefix} ${startTime} - ${endTime}`
  }

  return `${datePrefix} ${startTime}`
}

// Generate a date for tonight at a specific hour
function getTonightAt(hour: number): string {
  const date = new Date()
  date.setHours(hour, 0, 0, 0)
  return date.toISOString()
}

// Generate a date for tomorrow at a specific hour
function getTomorrowAt(hour: number): string {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  date.setHours(hour, 0, 0, 0)
  return date.toISOString()
}

const defaultEvent: Event = {
  id: '1',
  title: 'House Music Night at The Loft',
  category: 'Music',
  venue: 'The Loft',
  neighborhood: 'SoHo',
  city: 'New York',
  startDateTime: getTonightAt(21), // 9 PM tonight
  endDateTime: getTomorrowAt(3), // 3 AM tomorrow
  priceRange: '$45 - $150',
  image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800',
  vibeTags: ['High energy', 'Late night', 'Dressy'],
  eventSignal: 'going-fast',
  organizerRating: 4.8,
  reviewCount: 234
}

export interface EventCardProps {
  data?: {
    event?: Event
  }
  actions?: {
    onClick?: (event: Event) => void
  }
  appearance?: {
    variant?: 'default' | 'compact' | 'horizontal' | 'covered'
    showSignal?: boolean
    showTags?: boolean
    showRating?: boolean
  }
}

function EventLocation({ event }: { event: Event }) {
  const locationType = event.locationType || 'physical'

  if (locationType === 'online') {
    return (
      <span className="flex items-center gap-1">
        <Video className="h-3.5 w-3.5" />
        Online Event
      </span>
    )
  }

  if (locationType === 'hybrid') {
    return (
      <>
        <span className="flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5" />
          {event.venue}
          {event.neighborhood && `, ${event.neighborhood}`}
        </span>
        <span className="flex items-center gap-1">
          <Video className="h-3.5 w-3.5" />
          + Online
        </span>
      </>
    )
  }

  // Physical (default)
  return (
    <span className="flex items-center gap-1">
      <MapPin className="h-3.5 w-3.5" />
      {event.venue}
      {event.neighborhood && `, ${event.neighborhood}`}
    </span>
  )
}

function EventSignalBadge({ signal }: { signal: Event['eventSignal'] }) {
  if (!signal) return null

  const config: Record<NonNullable<Event['eventSignal']>, { label: string; icon: typeof Flame; className: string }> = {
    'going-fast': {
      label: 'Going Fast',
      icon: Flame,
      className: 'bg-orange-500/10 text-orange-600 border-orange-200'
    },
    'popular': {
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
    'canceled': {
      label: 'Canceled',
      icon: XCircle,
      className: 'bg-gray-500/10 text-gray-600 border-gray-200'
    },
    'ended': {
      label: 'Ended',
      icon: CalendarX,
      className: 'bg-gray-500/10 text-gray-600 border-gray-200'
    },
    'postponed': {
      label: 'Postponed',
      icon: CirclePause,
      className: 'bg-yellow-500/10 text-yellow-600 border-yellow-200'
    }
  }

  const { label, icon: Icon, className } = config[signal]

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${className}`}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  )
}

export function EventCard({ data, actions, appearance }: EventCardProps) {
  const { event = defaultEvent } = data ?? {}
  const { onClick } = actions ?? {}
  const {
    variant = 'default',
    showSignal = true,
    showTags = true,
    showRating = true
  } = appearance ?? {}

  const handleClick = () => {
    if (onClick) {
      onClick(event)
    }
  }

  if (variant === 'covered') {
    return (
      <div
        className="relative overflow-hidden rounded-lg border cursor-pointer"
        onClick={handleClick}
      >
        <div className="min-h-[280px] sm:aspect-[16/9] sm:min-h-0 w-full">
          {event.image ? (
            <img
              src={event.image}
              alt={event.title}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 h-full w-full bg-muted" />
          )}
        </div>
        <div className="absolute inset-0 bg-black/60" />
        <div className="absolute inset-0 flex flex-col justify-end p-4 text-white">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-[10px] font-medium uppercase tracking-wide text-white/70">
                {event.category}
              </p>
              {showSignal && event.eventSignal && (
                <EventSignalBadge signal={event.eventSignal} />
              )}
            </div>
            <h2 className="mt-1 text-lg font-semibold leading-tight">
              {event.title}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/80">
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {formatEventDateTime(event.startDateTime, event.endDateTime)}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {event.venue}
                {event.neighborhood && `, ${event.neighborhood}`}
              </span>
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
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="font-semibold">{event.priceRange}</span>
                {showRating && event.organizerRating && (
                  <span className="flex items-center gap-1 text-sm text-white/70">
                    <Star className="h-3.5 w-3.5 fill-current text-yellow-400" />
                    {event.organizerRating}
                  </span>
                )}
              </div>
              <Button
                size="sm"
                variant="secondary"
                className="w-full sm:w-auto"
                onClick={(e) => {
                  e.stopPropagation()
                  handleClick()
                }}
              >
                View Event
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (variant === 'horizontal') {
    return (
      <div
        className="flex flex-col sm:flex-row gap-4 rounded-lg border bg-card p-3 cursor-pointer hover:bg-accent/50 transition-colors"
        onClick={handleClick}
      >
        {event.image && (
          <div className="aspect-video sm:aspect-square sm:h-24 sm:w-24 shrink-0 overflow-hidden rounded-md">
            <img
              src={event.image}
              alt={event.title}
              className="h-full w-full object-cover"
            />
          </div>
        )}
        <div className="flex flex-1 flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {event.category}
              </p>
              {showSignal && event.eventSignal && (
                <EventSignalBadge signal={event.eventSignal} />
              )}
            </div>
            <h3 className="line-clamp-2 text-sm font-medium leading-tight">
              {event.title}
            </h3>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatEventDateTime(event.startDateTime, event.endDateTime)}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {event.venue}
              </span>
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
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">{event.priceRange}</span>
              {showRating && event.organizerRating && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Star className="h-3 w-3 fill-current text-yellow-500" />
                  {event.organizerRating}
                </span>
              )}
            </div>
            <Button
              size="sm"
              className="w-full sm:w-auto"
              onClick={(e) => {
                e.stopPropagation()
                handleClick()
              }}
            >
              View
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (variant === 'compact') {
    return (
      <div
        className="flex h-full flex-col justify-between rounded-lg border bg-card p-3 cursor-pointer hover:bg-accent/50 transition-colors"
        onClick={handleClick}
      >
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {event.category}
            </p>
            {showSignal && event.eventSignal && (
              <EventSignalBadge signal={event.eventSignal} />
            )}
          </div>
          <h3 className="line-clamp-2 text-sm font-medium">{event.title}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatEventDateTime(event.startDateTime, event.endDateTime)}
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {event.venue}
            </span>
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
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{event.priceRange}</span>
            {showRating && event.organizerRating && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Star className="h-3 w-3 fill-current text-yellow-500" />
                {event.organizerRating}
              </span>
            )}
          </div>
          <Button
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              handleClick()
            }}
          >
            View
          </Button>
        </div>
      </div>
    )
  }

  // Default variant
  return (
    <div
      className="flex h-full flex-col overflow-hidden rounded-lg border bg-card cursor-pointer hover:bg-accent/50 transition-colors"
      onClick={handleClick}
    >
      {event.image && (
        <div className="aspect-video overflow-hidden">
          <img
            src={event.image}
            alt={event.title}
            className="h-full w-full object-cover transition-transform hover:scale-105"
          />
        </div>
      )}
      <div className="flex flex-1 flex-col justify-between p-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {event.category}
            </p>
            {showSignal && event.eventSignal && (
              <EventSignalBadge signal={event.eventSignal} />
            )}
          </div>
          <h3 className="line-clamp-2 font-medium">{event.title}</h3>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {formatEventDateTime(event.startDateTime, event.endDateTime)}
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {event.venue}
              {event.neighborhood && `, ${event.neighborhood}`}
            </span>
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
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="font-medium">{event.priceRange}</span>
            {showRating && event.organizerRating && (
              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                <Star className="h-3.5 w-3.5 fill-current text-yellow-500" />
                {event.organizerRating}
                {event.reviewCount && (
                  <span className="text-xs">({event.reviewCount})</span>
                )}
              </span>
            )}
          </div>
          <Button
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              handleClick()
            }}
          >
            View Event
          </Button>
        </div>
      </div>
    </div>
  )
}
