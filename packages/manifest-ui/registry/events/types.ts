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

export type VibeTag =
  | 'All night'
  | 'Beginner-friendly'
  | 'Casual'
  | 'Chill'
  | 'Classic'
  | 'Cocktails'
  | 'Creative'
  | 'Date night'
  | 'Discover'
  | 'Dressy'
  | 'Educational'
  | 'Exciting'
  | 'Exclusive'
  | 'Family-friendly'
  | 'Fun'
  | 'Hands-on'
  | 'High energy'
  | 'Immersive'
  | 'Interactive'
  | 'Intimate'
  | 'Kids'
  | 'Late night'
  | 'Legendary'
  | 'Outdoor'
  | 'Premium'
  | 'Relaxing'
  | 'Scenic'
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
  category: string // "Music", "Comedy", "Classes", "Nightlife", "Sports", "Food & Drink", "Arts", "Film", "Networking", "Festivals", "Wellness", "Social", "Games", "Gallery"
  venue: string
  neighborhood?: string | null
  city: string
  dateTime: string // Display format: "Tonight 9:00 PM - 3:00 AM", "Tomorrow 6:00 AM", "In 2 days 8:00 PM"
  priceRange: string // "$45 - $150", "Free", "Free - $5"
  image?: string // Cover image URL for the event
  coordinates?: { lat: number; lng: number } // For map display in fullscreen mode
  vibeTags?: VibeTag[]
  vibeDescription?: string
  aiSummary?: string // AI-generated match explanation
  lineup?: string[]
  ticketTiers?: string[] // ["General Admission $45", "VIP Access $120"]
  eventSignal?: EventSignal
  organizerRating?: number
  reviewCount?: number
  venueRating?: number
  ageRestriction?: string | null // "21+", "18+", "Ages 5-12", null
  hasMultipleDates?: boolean
  discount?: string // "TONIGHT ONLY - 40% OFF", "FREE - First 50 Only"
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

export interface TicketSelection {
  tierId: string
  quantity: number
}

export interface EventBooking {
  id: string
  event: Event
  tickets: { tierName: string; quantity: number; price: number }[]
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
  address?: string // Street address for the venue
  coordinates?: { lat: number; lng: number } // For map display
  attendeesCount?: number // "537 going"
  friendsGoing?: { name: string; avatar?: string }[]
  highlights?: string[] // "2 hours", "In person"
  goodToKnow?: {
    accessibility?: string[]
    dressCode?: string
    parking?: string
    duration?: string
    doorsOpen?: string
    showtime?: string
    ageRestriction?: string
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
  relatedTags?: string[] // "Los Angeles Events", "California Nightlife"
}
