// Shared types for Events category components

export type EventSignal =
  | 'going-fast'
  | 'popular'
  | 'just-added'
  | 'sales-end-soon'
  | 'few-tickets-left'
  | 'canceled'
  | 'ended'
  | 'postponed'

export type TicketSignal =
  | 'discount-applied'
  | 'few-tickets-left'
  | 'less-than-10-remaining'
  | 'more-than-11-remaining'
  | 'not-yet-on-sale'
  | 'sales-end-soon'
  | 'sales-ended'
  | 'sold-out'
  | 'unavailable'
  | 'unlocked'

export type EventLocationType = 'physical' | 'online' | 'hybrid'

export type VibeTag =
  | 'All night'
  | 'Beginner-friendly'
  | 'Casual'
  | 'Classic'
  | 'Cocktails'
  | 'Creative'
  | 'Date night'
  | 'Discover'
  | 'Dressy'
  | 'Educational'
  | 'Exciting'
  | 'Family-friendly'
  | 'Fun'
  | 'Hands-on'
  | 'High energy'
  | 'Interactive'
  | 'Intimate'
  | 'Late night'
  | 'Outdoor'
  | 'Relaxing'
  | 'Social'
  | 'Sophisticated'
  | 'Tasting'
  | 'Underground'
  | 'Upscale'
  | 'Views'
  | 'Wellness'

export interface Event {
  id: string
  title: string
  category: string // "Music", "Comedy", "Classes", "Nightlife", "Sports"
  locationType?: EventLocationType // "physical", "online", "hybrid" - defaults to "physical"
  venue?: string // Optional for online events
  neighborhood?: string
  city?: string // Optional for online events
  onlineUrl?: string // For online/hybrid events
  startDateTime: string // ISO format: "2025-01-11T21:00:00Z"
  endDateTime?: string // ISO format: "2025-01-12T03:00:00Z"
  priceRange: string // "$45 - $150", "Free"
  image?: string
  vibeTags?: VibeTag[] // ["High energy", "Late night", "Dressy"]
  vibeDescription?: string
  aiSummary?: string // AI-generated match explanation
  lineup?: string[]
  eventSignal?: EventSignal
  ticketSignal?: TicketSignal
  organizerRating?: number
  reviewCount?: number
  hasMultipleDates?: boolean
  discount?: string
}

export interface TicketTier {
  id: string
  name: string // "General Admission", "VIP Access"
  price: number
  description?: string
  available: number
  benefits?: string[]
  signal?: TicketSignal
}

export interface Organizer {
  id: string
  name: string
  image?: string
  rating: number
  reviewCount: number
  verified?: boolean
  followers?: number
  eventsCount?: number
  hostingYears?: number
  responseRate?: 'very responsive' | 'responsive' | 'slow'
  trackRecord?: 'great' | 'good' | 'new'
}

export interface EventVenue {
  name: string
  address: string
  neighborhood?: string
  city: string
  coordinates?: { lat: number; lng: number }
  image?: string
  rating?: number
}

export interface TicketSelection {
  tierId: string
  quantity: number
}

export interface EventBooking {
  id: string
  event: Event
  tickets: { tier: TicketTier; quantity: number }[]
  total: number
  fees: number
  confirmationCode: string
  qrCode?: string
  purchaseDate: string
}

// Extended Event with full details for event-detail component
export interface EventDetails extends Event {
  images?: string[] // Multiple images for carousel
  description?: string
  organizer?: Organizer
  venue_details?: EventVenue
  tiers?: TicketTier[]
  attendeesCount?: number // "537 going"
  friendsGoing?: { name: string; avatar?: string }[]
  highlights?: string[] // "2 hours", "In person"
  goodToKnow?: {
    accessibility?: string[]
    dressCode?: string
    ageRestriction?: string
    parking?: string
    duration?: string
    doorsOpen?: string
    showtime?: string
  }
  amenities?: string[]
  policies?: {
    refund?: string
    entry?: string
    idRequired?: boolean
    securityOnSite?: boolean
    items?: string[]
  }
  faq?: { question: string; answer: string }[]
  relatedEvents?: Event[]
  relatedTags?: string[] // "San Francisco Events", "California Events"
}
