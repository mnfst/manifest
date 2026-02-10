// Demo data for Events category components
// This file contains sample data used for component previews and documentation

import type { Event, EventDetails } from '../types'

// Helper to generate dates relative to today
function getDateAt(daysFromNow: number, hour: number): string {
  const date = new Date()
  date.setDate(date.getDate() + daysFromNow)
  date.setHours(hour, 0, 0, 0)
  return date.toISOString()
}

// Single event for EventCard default
export const demoEvent: Event = {
  title: 'NEON Vol. 9',
  category: 'Music',
  venue: 'Echoplex',
  neighborhood: 'Echo Park',
  city: 'Los Angeles',
  dateTime: 'Tonight 9:00 PM - 3:00 AM',
  priceRange: '$45 - $150',
  image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800',
  vibeTags: ['High energy', 'Late night', 'Dressy'],
  vibeDescription:
    'Immersive electronic experience with world-class DJs and stunning visuals.',
  aiSummary:
    "Immersive electronic night with world-class DJs and stunning visuals at LA's top-rated venue.",
  lineup: ['DJ Shadow', 'Bonobo', 'Four Tet', 'Caribou'],
  ticketTiers: [
    'General Admission $45',
    'VIP Access $120',
    'Backstage Pass $150'
  ],
  eventSignal: 'going-fast',
  organizerRating: 4.8,
  reviewCount: 12453,
  venueRating: 4.8,
  ageRestriction: '21+',
  hasMultipleDates: true
}

// 15 events for EventList default
export const demoEvents: Event[] = [
  {
    title: 'NEON Vol. 9',
    category: 'Music',
    venue: 'Echoplex',
    neighborhood: 'Echo Park',
    city: 'Los Angeles',
    dateTime: 'Tonight 9:00 PM - 3:00 AM',
    priceRange: '$45 - $150',
    image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800',
    coordinates: { lat: 34.0781, lng: -118.2606 },
    vibeTags: ['High energy', 'Late night'],
    eventSignal: 'going-fast',
    organizerRating: 4.8,
    reviewCount: 12453,
    ageRestriction: '21+'
  },
  {
    title: 'The Midnight Show',
    category: 'Comedy',
    venue: 'The Comedy Underground',
    neighborhood: 'Santa Monica',
    city: 'Los Angeles',
    dateTime: 'Tonight 10:00 PM - 12:00 AM',
    priceRange: '$15 - $35',
    image: 'https://images.unsplash.com/photo-1585699324551-f6c309eedeca?w=800',
    coordinates: { lat: 34.0195, lng: -118.4912 },
    vibeTags: ['Social', 'Late night'],
    eventSignal: 'popular',
    organizerRating: 4.7,
    reviewCount: 3241,
    discount: 'TONIGHT ONLY - 40% OFF'
  },
  {
    title: 'Salsa Sundays @ Echo Park',
    category: 'Classes',
    venue: 'Echo Park Lake',
    neighborhood: 'Echo Park',
    city: 'Los Angeles',
    dateTime: 'Saturday 6:00 PM - 10:00 PM',
    priceRange: 'Free',
    image: 'https://images.unsplash.com/photo-1504609813442-a8924e83f76e?w=800',
    coordinates: { lat: 34.0731, lng: -118.2608 },
    vibeTags: ['High energy', 'Social'],
    eventSignal: 'just-added',
    organizerRating: 4.9,
    reviewCount: 8764
  },
  {
    title: 'Dawn Flow: Griffith Park',
    category: 'Classes',
    venue: 'Griffith Park',
    neighborhood: 'Los Feliz',
    city: 'Los Angeles',
    dateTime: 'Tomorrow 6:00 AM - 8:00 AM',
    priceRange: 'Free',
    image: 'https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=800',
    coordinates: { lat: 34.1365, lng: -118.2943 },
    vibeTags: ['Chill', 'Wellness', 'Outdoor'],
    organizerRating: 4.9,
    reviewCount: 8764,
    discount: 'FREE - First 50 Only'
  },
  {
    title: 'Lakers vs Celtics',
    category: 'Sports',
    venue: 'Crypto.com Arena',
    neighborhood: 'Downtown',
    city: 'Los Angeles',
    dateTime: 'Friday 7:30 PM - 10:30 PM',
    priceRange: '$125 - $850',
    image: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800',
    coordinates: { lat: 34.0430, lng: -118.2673 },
    vibeTags: ['High energy', 'Social', 'Premium'],
    eventSignal: 'sales-end-soon',
    organizerRating: 4.5,
    reviewCount: 2341
  },
  {
    title: 'Smorgasburg LA: Sunday Market',
    category: 'Food & Drink',
    venue: 'ROW DTLA',
    neighborhood: 'Arts District',
    city: 'Los Angeles',
    dateTime: 'Sunday 10:00 AM - 4:00 PM',
    priceRange: 'Free',
    image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800',
    coordinates: { lat: 34.0341, lng: -118.2324 },
    vibeTags: ['Family-friendly', 'Outdoor', 'Social'],
    organizerRating: 4.8,
    reviewCount: 5632
  },
  {
    title: 'LACMA After Hours',
    category: 'Arts',
    venue: 'LACMA',
    neighborhood: 'Miracle Mile',
    city: 'Los Angeles',
    dateTime: 'Friday 7:00 PM - 11:00 PM',
    priceRange: '$35 - $75',
    image: 'https://images.unsplash.com/photo-1531243269054-5ebf6f34081e?w=800',
    coordinates: { lat: 34.0639, lng: -118.3592 },
    vibeTags: ['Chill', 'Date night', 'Sophisticated'],
    organizerRating: 4.7,
    reviewCount: 1234,
    ageRestriction: '21+',
    discount: 'MEMBER PRICE'
  },
  {
    title: 'Blue Note Under Stars',
    category: 'Music',
    venue: 'Hollywood Bowl',
    neighborhood: 'Hollywood Hills',
    city: 'Los Angeles',
    dateTime: 'Saturday 8:00 PM - 11:00 PM',
    priceRange: '$45 - $200',
    image: 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=800',
    coordinates: { lat: 34.1122, lng: -118.3391 },
    vibeTags: ['Chill', 'Date night', 'Outdoor'],
    lineup: ['Kamasi Washington', 'Thundercat', 'Terrace Martin'],
    organizerRating: 4.8,
    reviewCount: 12453
  },
  {
    title: 'Meraki: Seth Troxler',
    category: 'Nightlife',
    venue: 'Sound Nightclub',
    neighborhood: 'Hollywood',
    city: 'Los Angeles',
    dateTime: 'Saturday 10:00 PM - 4:00 AM',
    priceRange: '$35 - $65',
    image: 'https://images.unsplash.com/photo-1571266028243-e4733b0f0bb0?w=800',
    coordinates: { lat: 34.0928, lng: -118.3287 },
    vibeTags: ['High energy', 'Late night', 'Underground'],
    lineup: ['Amelie Lens', 'I Hate Models', 'FJAAK'],
    organizerRating: 4.6,
    reviewCount: 1876,
    ageRestriction: '21+'
  },
  {
    title: 'Whitney Cummings + Friends',
    category: 'Comedy',
    venue: 'The Laugh Factory',
    neighborhood: 'Hollywood',
    city: 'Los Angeles',
    dateTime: 'In 2 days 8:00 PM - 11:00 PM',
    priceRange: '$25 - $55',
    image: 'https://images.unsplash.com/photo-1527224538127-2104bb71c51b?w=800',
    coordinates: { lat: 34.0901, lng: -118.3615 },
    vibeTags: ['Chill', 'Social', 'Date night'],
    organizerRating: 4.7,
    reviewCount: 3241,
    ageRestriction: '18+'
  },
  {
    title: 'Venice Beach Drum Circle',
    category: 'Music',
    venue: 'Venice Beach Boardwalk',
    neighborhood: 'Venice',
    city: 'Los Angeles',
    dateTime: 'Sunday 4:00 PM - 8:00 PM',
    priceRange: 'Free',
    image: 'https://images.unsplash.com/photo-1506157786151-b8491531f063?w=800',
    coordinates: { lat: 33.9850, lng: -118.4695 },
    vibeTags: ['Outdoor', 'Social', 'Chill'],
    eventSignal: 'popular',
    organizerRating: 4.6,
    reviewCount: 2145
  },
  {
    title: 'Rooftop Cinema: Blade Runner',
    category: 'Film',
    venue: 'Rooftop Cinema Club',
    neighborhood: 'DTLA',
    city: 'Los Angeles',
    dateTime: 'Friday 8:30 PM - 11:00 PM',
    priceRange: '$25 - $45',
    image: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800',
    coordinates: { lat: 34.0407, lng: -118.2468 },
    vibeTags: ['Date night', 'Views', 'Chill'],
    organizerRating: 4.8,
    reviewCount: 892
  },
  {
    title: 'Dodgers vs Giants',
    category: 'Sports',
    venue: 'Dodger Stadium',
    neighborhood: 'Elysian Park',
    city: 'Los Angeles',
    dateTime: 'Saturday 1:10 PM - 4:30 PM',
    priceRange: '$35 - $350',
    image: 'https://images.unsplash.com/photo-1566577739112-5180d4bf9390?w=800',
    coordinates: { lat: 34.0739, lng: -118.2400 },
    vibeTags: ['Family-friendly', 'Social', 'High energy'],
    eventSignal: 'few-tickets-left',
    organizerRating: 4.7,
    reviewCount: 15678
  },
  {
    title: 'Natural Wine Fair',
    category: 'Food & Drink',
    venue: 'Grand Central Market',
    neighborhood: 'Downtown',
    city: 'Los Angeles',
    dateTime: 'Sunday 12:00 PM - 6:00 PM',
    priceRange: '$45 - $85',
    image: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=800',
    coordinates: { lat: 34.0508, lng: -118.2490 },
    vibeTags: ['Tasting', 'Social', 'Sophisticated'],
    eventSignal: 'just-added',
    organizerRating: 4.5,
    reviewCount: 567,
    ageRestriction: '21+'
  },
  {
    title: 'Meditation in the Gardens',
    category: 'Wellness',
    venue: 'The Getty Center',
    neighborhood: 'Brentwood',
    city: 'Los Angeles',
    dateTime: 'Sunday 7:00 AM - 9:00 AM',
    priceRange: 'Free',
    image: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800',
    coordinates: { lat: 34.0780, lng: -118.4741 },
    vibeTags: ['Wellness', 'Outdoor', 'Chill'],
    organizerRating: 4.9,
    reviewCount: 1234
  }
]

// Detailed event for EventDetail default
export const demoEventDetails: EventDetails = {
  title: 'Sunglasses at Night: Underground Techno',
  category: 'Nightlife',
  venue: 'The White Rabbit',
  neighborhood: 'The Woodlands',
  city: 'Houston, TX',
  startDateTime: getDateAt(2, 22),
  endDateTime: getDateAt(3, 4),
  priceRange: '$15 - $30',
  images: [
    'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800',
    'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800',
    'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800'
  ],
  vibeTags: ['High energy', 'Late night', 'Underground'],
  eventSignal: 'going-fast',
  aiSummary: 'Raw, unfiltered techno in an authentic warehouse setting.',
  description:
    'Experience the raw energy of underground techno. Industrial beats, immersive visuals, and a crowd that lives for the music.',
  lineup: ['Amelie Lens', 'I Hate Models', 'FJAAK'],
  attendeesCount: 537,
  friendsGoing: [
    { name: 'Alex', avatar: 'https://i.pravatar.cc/40?u=alex' },
    { name: 'Sam', avatar: 'https://i.pravatar.cc/40?u=sam' }
  ],
  organizer: {
    name: 'Midnight Lovers',
    image: 'https://i.pravatar.cc/80?u=midnight',
    rating: 4.5,
    reviewCount: 1067,
    verified: true,
    followers: 1200,
    eventsCount: 154,
    hostingYears: 8,
    trackRecord: 'great',
    responseRate: 'very responsive'
  },
  venue_details: {
    name: 'The White Rabbit',
    address: '8827 Nasher Ave',
    city: 'Houston TX',
    coordinates: { lat: 29.7604, lng: -95.3698 }
  },
  tiers: [
    { name: 'General Admission', price: 15, available: 50 },
    {
      name: 'VIP Access',
      price: 30,
      available: 20,
      benefits: ['Skip the line', 'Exclusive lounge']
    }
  ],
  goodToKnow: {
    duration: '2 hours',
    doorsOpen: '7:00 PM',
    showtime: '7:30 PM',
    ageRestriction: '21+',
    dressCode: 'Casual',
    parking: 'Limited, leave early to avoid long queues'
  },
  policies: {
    refund: 'No refunds. Tickets are transferable.',
    entry: 'Open 2 hours before event',
    idRequired: true,
    securityOnSite: true
  },
  faq: [
    {
      question: 'What is the refund policy?',
      answer: 'No refunds. Tickets are transferable.'
    },
    {
      question: 'When do doors open?',
      answer: 'Open 2 hours before event.'
    },
    {
      question: 'Is there parking?',
      answer: 'Limited, leave early to avoid long queues.'
    }
  ],
  relatedTags: ['Houston Events', 'Texas Nightlife', 'Techno Parties']
}

// Ticket tiers for TicketTierSelect
export const demoTicketTiers = [
  {
    id: '1',
    name: 'General Admission',
    price: 45,
    fee: 5,
    available: 100,
    maxPerOrder: 10,
  },
  {
    id: '2',
    name: 'VIP',
    price: 150,
    fee: 15,
    available: 20,
    maxPerOrder: 4,
    description: 'Includes backstage access',
  },
]

// Event confirmation data
export const demoEventConfirmation = {
  orderNumber: 'EVT-12345',
  eventTitle: 'Summer Music Festival',
  ticketCount: 2,
  recipientEmail: 'customer@example.com',
  eventDate: 'Jan 20, 2024',
  eventLocation: 'Central Park, New York',
  organizer: {
    name: 'Live Nation',
  },
}
