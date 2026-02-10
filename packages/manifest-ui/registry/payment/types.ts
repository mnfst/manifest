// Shared types for Payment category components

/**
 * Represents an item in an order.
 * @interface OrderItem
 */
export interface OrderItem {
  id: string
  name?: string
  quantity?: number
  price?: number
  image?: string
}
