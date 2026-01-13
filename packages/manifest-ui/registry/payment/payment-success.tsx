'use client'

import { Button } from '@/components/ui/button'
import { Check, ExternalLink } from 'lucide-react'

/**
 * Props for the PaymentSuccess component.
 * @interface PaymentSuccessProps
 * @property {object} [data] - Order and product data
 * @property {string} [data.orderId] - Order reference number
 * @property {string} [data.productName] - Name of the purchased product
 * @property {string} [data.productImage] - Product image URL
 * @property {number} [data.price] - Total price paid
 * @property {string} [data.deliveryDate] - Expected delivery date string
 * @property {object} [actions] - Callback functions for user actions
 * @property {function} [actions.onTrackOrder] - Called when user clicks track order
 * @property {object} [appearance] - Visual customization options
 * @property {string} [appearance.currency] - Currency code for formatting
 */
export interface PaymentSuccessProps {
  data?: {
    orderId?: string
    productName?: string
    productImage?: string
    price?: number
    deliveryDate?: string
  }
  actions?: {
    onTrackOrder?: () => void
  }
  appearance?: {
    currency?: string
  }
}

/**
 * A payment success confirmation component showing order details and tracking option.
 * Displays responsive layouts optimized for both mobile and desktop views.
 *
 * Features:
 * - Success checkmark icon
 * - Product image and name display
 * - Order ID reference
 * - Price and delivery date information
 * - Track order button with external link icon
 * - Responsive mobile/desktop layouts
 *
 * @component
 * @example
 * ```tsx
 * <PaymentSuccess
 *   data={{
 *     orderId: "ORD-2024-1234",
 *     productName: "Premium Headphones",
 *     productImage: "/images/headphones.jpg",
 *     price: 199.99,
 *     deliveryDate: "Mon. Jan 15"
 *   }}
 *   actions={{
 *     onTrackOrder: () => console.log("Track order clicked")
 *   }}
 *   appearance={{ currency: "USD" }}
 * />
 * ```
 */
export function PaymentSuccess({ data, actions, appearance }: PaymentSuccessProps) {
  const {
    orderId = 'ORD-2024-7842',
    productName = "Air Force 1 '07",
    productImage = '/demo/shoe-1.png',
    price = 119,
    deliveryDate = 'Tue. Dec 10',
  } = data ?? {}
  const { onTrackOrder } = actions ?? {}
  const { currency = 'EUR' } = appearance ?? {}
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency
    }).format(value)
  }

  return (
    <div className="w-full rounded-lg bg-card border">
      {/* Mobile layout */}
      <div className="sm:hidden p-4 space-y-4">
        {/* Success icon and title */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-foreground">
            <Check className="h-5 w-5 text-background" />
          </div>
          <p className="font-semibold text-base">Payment successful</p>
        </div>

        {/* Product image centered */}
        <div className="flex justify-center">
          <div className="h-20 w-20 rounded-lg overflow-hidden bg-muted">
            {productImage ? (
              <img
                src={productImage}
                alt={productName}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full bg-muted" />
            )}
          </div>
        </div>

        {/* Product info stacked */}
        <div className="text-center space-y-1">
          <p className="font-medium text-sm">{productName}</p>
          <p className="text-xs text-muted-foreground">Order #{orderId}</p>
        </div>

        {/* Price and delivery */}
        <div className="flex items-center justify-between py-3 border-y">
          <div>
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-lg font-semibold">{formatCurrency(price)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Delivery</p>
            <p className="text-sm font-medium">{deliveryDate}</p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onTrackOrder}
          className="w-full"
        >
          Track order
          <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Desktop layout - compact inline */}
      <div className="hidden sm:flex items-center gap-3 p-3">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-foreground">
          <Check className="h-4 w-4 text-background" />
        </div>
        <div className="h-9 w-9 flex-shrink-0 rounded-lg overflow-hidden bg-muted">
          {productImage ? (
            <img
              src={productImage}
              alt={productName}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full bg-muted" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">{productName}</span>
            <span className="text-xs text-muted-foreground">#{orderId}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Delivery: {deliveryDate}</span>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="font-semibold">{formatCurrency(price)}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onTrackOrder}
          className="flex-shrink-0"
        >
          Track
          <ExternalLink className="ml-1 h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}
