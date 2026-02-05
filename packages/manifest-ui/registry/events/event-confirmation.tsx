'use client'

import { Button } from '@/components/ui/button'
import {
  CheckCircle,
  Facebook,
  Mail,
  MessageCircle,
  Twitter
} from 'lucide-react'
import { demoEventConfirmation } from './demo/events'

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EventConfirmationProps
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Props for the EventConfirmation component. Displays booking success message,
 * ticket delivery info, organizer follow card, and social sharing options.
 */
export interface EventConfirmationProps {
  data?: {
    /** Order/confirmation number. */
    orderNumber?: string
    /** Event title. */
    eventTitle?: string
    /** Number of tickets purchased. */
    ticketCount?: number
    /** Email address where tickets were sent. */
    recipientEmail?: string
    /** Event date and time string. */
    eventDate?: string
    /** Event location. */
    eventLocation?: string
    /** Event organizer information. */
    organizer?: {
      name: string
      image?: string
    }
  }
  actions?: {
    /** Called when "Take me to my tickets" button is clicked. */
    onViewTickets?: () => void
    /** Called when "Follow" organizer button is clicked. */
    onFollowOrganizer?: () => void
    /** Called when a social share button is clicked. */
    onShare?: (platform: 'facebook' | 'twitter' | 'messenger' | 'email') => void
  }
}

/**
 * An event booking confirmation component with order details and sharing.
 * Displays success message, ticket info, and social share options.
 *
 * Features:
 * - Success header with order number
 * - Event details (title, date, location)
 * - Ticket delivery info with change option
 * - Organizer follow card
 * - Social sharing buttons (Facebook, Messenger, Twitter, Email)
 * - View tickets button
 *
 * @component
 * @example
 * ```tsx
 * <EventConfirmation
 *   data={{
 *     orderNumber: "#14040333743",
 *     eventTitle: "Concert Night",
 *     ticketCount: 2,
 *     recipientEmail: "user@example.com",
 *     eventDate: "Friday, Feb 6 · 8pm PST",
 *     eventLocation: "Los Angeles, CA",
 *     organizer: { name: "Event Organizer", image: "/avatar.jpg" }
 *   }}
 *   actions={{
 *     onViewTickets: () => console.log("View tickets"),
 *     onFollowOrganizer: () => console.log("Follow"),
 *     onShare: (platform) => console.log("Share on:", platform)
 *   }}
 * />
 * ```
 */
export function EventConfirmation({ data, actions }: EventConfirmationProps) {
  const resolved: NonNullable<EventConfirmationProps['data']> = data ?? demoEventConfirmation
  const orderNumber = resolved?.orderNumber
  const eventTitle = resolved?.eventTitle
  const ticketCount = resolved?.ticketCount
  const recipientEmail = resolved?.recipientEmail
  const eventDate = resolved?.eventDate
  const eventLocation = resolved?.eventLocation
  const organizer = resolved?.organizer
  const { onViewTickets, onFollowOrganizer, onShare } =
    actions ?? {}

  return (
    <div className="rounded-xl border bg-card p-6 ">
      {/* Success header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
            <CheckCircle className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Thanks for your order!</h1>
            {orderNumber && <p className="text-sm text-muted-foreground">{orderNumber}</p>}
          </div>
        </div>
        <Button onClick={onViewTickets} size="lg">
          Take me to my tickets
        </Button>
      </div>

      {/* Event details */}
      <div className="mb-8">
        <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase mb-2">
          You're going to
        </p>
        {eventTitle && <h2 className="text-2xl font-bold leading-tight mb-6">{eventTitle}</h2>}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {/* Ticket sent to */}
          {recipientEmail && (
            <div>
              <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase mb-1">
                {ticketCount ?? 1} Ticket sent to
              </p>
              <p className="text-sm">{recipientEmail}</p>
            </div>
          )}

          {/* Date */}
          {eventDate && (
            <div>
              <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase mb-1">
                Date
              </p>
              <p className="text-sm">{eventDate}</p>
            </div>
          )}

          {/* Location */}
          {eventLocation && (
            <div>
              <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase mb-1">
                Location
              </p>
              <p className="text-sm">{eventLocation}</p>
            </div>
          )}
        </div>
      </div>

      {/* Organizer follow section */}
      {organizer && (
        <div className="rounded-lg border bg-muted/30 p-4 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {organizer.image ? (
                <img
                  src={organizer.image}
                  alt={organizer.name}
                  className="h-12 w-12 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-100">
                  <span className="text-lg font-semibold text-orange-600">
                    {organizer.name.charAt(0)}
                  </span>
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground">
                  Don't miss out on events from
                </p>
                <p className="font-semibold">{organizer.name}</p>
                <p className="text-xs text-muted-foreground">
                  Created this event
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={onFollowOrganizer}>
              Follow
            </Button>
          </div>
        </div>
      )}

      {/* Social sharing */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => onShare?.('facebook')}
          className="flex h-10 w-10 items-center justify-center rounded-full border hover:bg-muted transition-colors"
          aria-label="Share on Facebook"
        >
          <Facebook className="h-5 w-5" />
        </button>
        <button
          onClick={() => onShare?.('messenger')}
          className="flex h-10 w-10 items-center justify-center rounded-full border hover:bg-muted transition-colors"
          aria-label="Share on Messenger"
        >
          <MessageCircle className="h-5 w-5" />
        </button>
        <button
          onClick={() => onShare?.('twitter')}
          className="flex h-10 w-10 items-center justify-center rounded-full border hover:bg-muted transition-colors"
          aria-label="Share on Twitter"
        >
          <Twitter className="h-5 w-5" />
        </button>
        <button
          onClick={() => onShare?.('email')}
          className="flex h-10 w-10 items-center justify-center rounded-full border hover:bg-muted transition-colors"
          aria-label="Share via Email"
        >
          <Mail className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}
