'use client'

import { Button } from '@/components/ui/button'
import { ArrowRight, Calendar, MapPin } from 'lucide-react'

/**
 * Props for the OrderConfirm component.
 * @interface OrderConfirmProps
 * @property {object} [data] - Product and delivery data
 * @property {string} [data.productName] - Name of the product
 * @property {string} [data.productVariant] - Product variant/color
 * @property {string} [data.productImage] - Product image URL
 * @property {number} [data.quantity] - Number of items
 * @property {number} [data.price] - Total price
 * @property {string} [data.deliveryDate] - Expected delivery date
 * @property {string} [data.deliveryAddress] - Delivery address
 * @property {boolean} [data.freeShipping] - Whether shipping is free
 * @property {object} [actions] - Callback functions for user actions
 * @property {function} [actions.onConfirm] - Called when user confirms the order
 * @property {object} [appearance] - Visual customization options
 * @property {string} [appearance.currency] - Currency code for formatting
 * @property {object} [control] - State control options
 * @property {boolean} [control.isLoading] - Shows loading state on confirm button
 */
export interface OrderConfirmProps {
  /** Content and data to display */
  data?: {
    productName?: string
    productVariant?: string
    productImage?: string
    quantity?: number
    price?: number
    deliveryDate?: string
    deliveryAddress?: string
    freeShipping?: boolean
  }
  /** User-triggerable callbacks */
  actions?: {
    onConfirm?: () => void
  }
  /** Visual configuration options */
  appearance?: {
    currency?: string
  }
  /** State management */
  control?: {
    isLoading?: boolean
  }
}

const DEFAULT_AIRPODS_IMAGE =
  'https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/MQD83?wid=400&hei=400&fmt=jpeg&qlt=95'

/**
 * An order confirmation component with product image, delivery info, and confirm action.
 * Displays responsive layouts for mobile and desktop with delivery details.
 *
 * Features:
 * - Product image and details display
 * - Variant and quantity information
 * - Price with free shipping indicator
 * - Delivery date and address
 * - Confirm order button with loading state
 * - Responsive mobile/desktop layouts
 *
 * @component
 * @example
 * ```tsx
 * <OrderConfirm
 *   data={{
 *     productName: "Wireless Earbuds",
 *     productVariant: "White",
 *     productImage: "/images/earbuds.jpg",
 *     quantity: 1,
 *     price: 149.99,
 *     deliveryDate: "Fri. Jan 20",
 *     deliveryAddress: "123 Main St, New York 10001",
 *     freeShipping: true
 *   }}
 *   actions={{
 *     onConfirm: () => console.log("Order confirmed")
 *   }}
 *   appearance={{ currency: "USD" }}
 *   control={{ isLoading: false }}
 * />
 * ```
 */
export function OrderConfirm({ data, actions, appearance, control }: OrderConfirmProps) {
  const {
    productName = 'Iyo Pro',
    productVariant = 'Midnight Black',
    productImage = DEFAULT_AIRPODS_IMAGE,
    quantity = 1,
    price = 299.0,
    deliveryDate = 'Tue. Dec 10',
    deliveryAddress = '123 Main Street, 10001',
    freeShipping = true,
  } = data ?? {}
  const { onConfirm } = actions ?? {}
  const { currency = 'USD' } = appearance ?? {}
  const { isLoading = false } = control ?? {}
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency
    }).format(value)
  }

  return (
    <div className="w-full rounded-md sm:rounded-lg bg-card">
      {/* Product info */}
      <div className="flex items-start gap-3 p-3 sm:gap-4 sm:p-2">
        <img
          src={productImage}
          alt={productName}
          className="h-12 w-12 sm:h-16 sm:w-16 rounded-sm sm:rounded-md object-contain bg-muted/30"
        />
        <div className="flex-1 min-w-0">
          {/* Mobile: stacked layout */}
          <h3 className="text-sm sm:text-base font-medium truncate">
            {productName}
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {productVariant} • Qty: {quantity}
          </p>
          {/* Mobile: price below product info */}
          <div className="mt-1 sm:hidden">
            <p className="text-sm font-semibold">{formatCurrency(price)}</p>
            {freeShipping && (
              <p className="text-xs text-green-600">Free shipping</p>
            )}
          </div>
        </div>
        {/* Desktop: price on the right */}
        <div className="hidden sm:block text-right">
          <p className="font-semibold">{formatCurrency(price)}</p>
          {freeShipping && (
            <p className="text-sm text-green-600">Free shipping</p>
          )}
        </div>
      </div>

      <div className="border-t" />

      {/* Delivery info & button */}
      <div className="p-3 space-y-3 sm:py-2 sm:pr-2 sm:pl-4 sm:space-y-0 sm:flex sm:items-center sm:justify-between">
        {/* Mobile: stacked, Desktop: inline */}
        <div className="space-y-1.5 sm:space-y-0 sm:flex sm:flex-wrap sm:items-center sm:gap-2 text-xs sm:text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
            <span>{deliveryDate}</span>
          </div>
          <span className="hidden sm:inline">•</span>
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
            <span className="truncate">{deliveryAddress}</span>
          </div>
        </div>

        <Button
          size="sm"
          className="w-full sm:w-auto"
          onClick={onConfirm}
          disabled={isLoading}
        >
          {isLoading ? 'Confirming...' : 'Confirm order'}
          <ArrowRight className="ml-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </Button>
      </div>
    </div>
  )
}
