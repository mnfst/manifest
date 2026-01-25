// Shared types for List category components

/**
 * Represents a product with pricing and display information.
 * @interface Product
 */
export interface Product {
  name?: string
  description?: string
  price?: number
  originalPrice?: number
  image?: string
  rating?: number
  badge?: string
  inStock?: boolean
}
