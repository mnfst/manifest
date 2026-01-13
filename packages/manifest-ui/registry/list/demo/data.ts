// Demo data for List category components
// This file contains sample data used for component previews and documentation

import type { Product } from '../product-list'

// Default products for ProductList
export const demoProducts: Product[] = [
  {
    name: "Air Force 1 '07",
    description: 'Nike',
    price: 119,
    image: '/demo/shoe-1.png',
    rating: 4.9,
    badge: 'New',
    inStock: true
  },
  {
    name: 'Air Max 90',
    description: 'Nike',
    price: 140,
    image: '/demo/shoe-2.png',
    rating: 4.8,
    inStock: true
  },
  {
    name: 'Air Max Plus',
    description: 'Nike',
    price: 170,
    originalPrice: 190,
    image: '/demo/shoe-4.png',
    rating: 4.7,
    badge: '-10%',
    inStock: true
  },
  {
    name: 'Dunk Low',
    description: 'Nike',
    price: 115,
    image: '/demo/shoe-3.png',
    rating: 4.6,
    inStock: true
  },
  {
    name: 'Jordan 1 Low',
    description: 'Nike',
    price: 135,
    image: '/demo/shoe-1.png',
    rating: 4.8,
    inStock: true
  },
  {
    name: 'Blazer Mid',
    description: 'Nike',
    price: 105,
    image: '/demo/shoe-2.png',
    rating: 4.5,
    inStock: true
  }
]
