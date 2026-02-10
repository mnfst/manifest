// Demo data for Payment category components
// This file contains sample data used for component previews and documentation

import type { OrderItem } from '../types'

// Default order items for OrderSummary
export const demoOrderItems: OrderItem[] = [
  { id: '1', name: 'Premium Headphones', quantity: 1, price: 199.99 },
  { id: '2', name: 'Wireless Charger', quantity: 2, price: 29.99 }
]

// Default order data for OrderSummary
export const demoOrderData = {
  items: demoOrderItems,
  subtotal: 259.97,
  shipping: 9.99,
  tax: 21.58,
  discount: 25.0,
  discountCode: 'SAVE10',
  total: 266.54,
}

// OrderConfirm component data
export const demoOrderConfirm = {
  productName: "Air Force 1 '07",
  productImage: 'https://ui.manifest.build/demo/shoe-1.png',
  price: 299,
  deliveryDate: 'Jan 20, 2024',
}

// AmountInput presets
export const demoAmountPresets = [10, 25, 50, 100]

// PaymentConfirmed component data
export const demoPaymentConfirmed = {
  productName: "Air Force 1 '07",
  productImage: 'https://ui.manifest.build/demo/shoe-1.png',
  price: 299,
  deliveryDate: 'Jan 20, 2024',
}
