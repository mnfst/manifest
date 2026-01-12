'use client'

import { Button } from '@/components/ui/button'
import { CheckCircle, Facebook, Twitter, Mail, MessageCircle } from 'lucide-react'

export interface EventConfirmationProps {
  data?: {
    orderNumber?: string
    eventTitle?: string
    ticketCount?: number
    recipientEmail?: string
    eventDate?: string
    eventLocation?: string
    organizer?: {
      name: string
      image?: string
    }
  }
  actions?: {
    onViewTickets?: () => void
    onChangeEmail?: () => void
    onFollowOrganizer?: () => void
    onShare?: (platform: 'facebook' | 'twitter' | 'messenger' | 'email') => void
  }
}

export function EventConfirmation({ data, actions }: EventConfirmationProps) {
  const {
    orderNumber = '#14040333743',
    eventTitle = "Cavity Free SF Children's Oral Health Strategic Plan Launch",
    ticketCount = 1,
    recipientEmail = 'user@example.com',
    eventDate = 'Thursday, February 19 · 9am - 12pm PST',
    eventLocation = 'San Francisco, CA',
    organizer = {
      name: 'CavityFree SF',
      image: undefined
    }
  } = data ?? {}
  const { onViewTickets, onChangeEmail, onFollowOrganizer, onShare } = actions ?? {}

  return (
    <div className="max-w-2xl mx-auto">
      {/* Success header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
            <CheckCircle className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Thanks for your order!</h1>
            <p className="text-sm text-muted-foreground">{orderNumber}</p>
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
        <h2 className="text-2xl font-bold leading-tight mb-6">{eventTitle}</h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {/* Ticket sent to */}
          <div>
            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase mb-1">
              {ticketCount} Ticket sent to
            </p>
            <p className="text-sm">{recipientEmail}</p>
            {onChangeEmail && (
              <button
                onClick={onChangeEmail}
                className="text-sm text-primary hover:underline"
              >
                Change
              </button>
            )}
          </div>

          {/* Date */}
          <div>
            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase mb-1">
              Date
            </p>
            <p className="text-sm">{eventDate}</p>
          </div>

          {/* Location */}
          <div>
            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase mb-1">
              Location
            </p>
            <p className="text-sm">{eventLocation}</p>
          </div>
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
                <p className="text-xs text-muted-foreground">Created this event</p>
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
