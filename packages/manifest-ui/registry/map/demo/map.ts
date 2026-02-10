// Demo data for Map category components
// This file contains sample data used for component previews and documentation

export const demoMapLocations = [
  {
    id: '1',
    name: 'The Embarcadero Grand',
    subtitle: 'Embarcadero',
    image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400',
    price: 329,
    priceLabel: '$329 per night',
    priceSubtext: 'USD · Includes taxes and fees',
    rating: 9.1,
    coordinates: [37.7935, -122.3938] as [number, number],
  },
  {
    id: '2',
    name: 'Hotel Nob Hill',
    subtitle: 'Nob Hill',
    image: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=400',
    price: 275,
    priceLabel: '$275 per night',
    priceSubtext: 'USD · Includes taxes and fees',
    rating: 8.7,
    coordinates: [37.7925, -122.4138] as [number, number],
  },
  {
    id: '3',
    name: 'Marina Bay Suites',
    subtitle: 'Marina District',
    image: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=400',
    price: 389,
    priceLabel: '$389 per night',
    priceSubtext: 'USD · Includes taxes and fees',
    rating: 9.4,
    coordinates: [37.8025, -122.4382] as [number, number],
  },
  {
    id: '4',
    name: 'Mission Street Inn',
    subtitle: 'Mission District',
    image: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=400',
    price: 189,
    priceLabel: '$189 per night',
    priceSubtext: 'USD · Includes taxes and fees',
    rating: 8.2,
    coordinates: [37.7599, -122.4148] as [number, number],
  },
  {
    id: '5',
    name: 'The Hayes Valley Hotel',
    subtitle: 'Hayes Valley',
    image: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=400',
    price: 245,
    priceLabel: '$245 per night',
    priceSubtext: 'USD · Includes taxes and fees',
    rating: 8.9,
    coordinates: [37.7759, -122.4245] as [number, number],
  },
]

export const demoMapCenter: [number, number] = [37.7749, -122.4194]
export const demoMapZoom = 12
