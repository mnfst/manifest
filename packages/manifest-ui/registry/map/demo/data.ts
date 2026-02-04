// Demo data for Map category components
// This file contains sample data used for component previews and documentation

export const demoMapLocations = [
  {
    id: '1',
    name: 'Blue Bottle Coffee',
    image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400',
    coordinates: [37.7823, -122.4075] as [number, number],
    description: 'Specialty coffee roaster',
  },
  {
    id: '2',
    name: 'City Lights Bookstore',
    image: 'https://images.unsplash.com/photo-1526243741027-444d633d7365?w=400',
    coordinates: [37.7976, -122.4064] as [number, number],
    description: 'Iconic independent bookstore',
  },
  {
    id: '3',
    name: 'Dolores Park',
    image: 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=400',
    coordinates: [37.7596, -122.4269] as [number, number],
    description: 'Popular city park with skyline views',
  },
]

export const demoMapCenter: [number, number] = [37.7749, -122.4194]
export const demoMapZoom = 12
