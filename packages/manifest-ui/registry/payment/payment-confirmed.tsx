'use client'

import { Button } from '@/components/ui/button'
import { Check, ExternalLink } from 'lucide-react'
import { demoPaymentConfirmed } from './demo/payment'

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PaymentConfirmedProps
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Props for a payment confirmation card with product image, price, delivery info,
 * and tracking button. Supports default (detailed) and compressed layouts.
 */
export interface PaymentConfirmedProps {
  data?: {
    /** Order reference number displayed in the header. */
    orderId?: string
    /** Name of the purchased product. */
    productName?: string
    /** Product description or variant details (e.g., "Nike - Size 42 - White"). Only shown in default variant. */
    productDescription?: string
    /** URL to the product image. */
    productImage?: string
    /** Total price paid for the order. */
    price?: number
    /** Expected delivery date string (e.g., "Tue. Dec 10"). */
    deliveryDate?: string
  }
  actions?: {
    /** Called when the user clicks the track order button. */
    onTrackOrder?: () => void
  }
  appearance?: {
    /**
     * Display variant: "default" shows detailed layout with header, "compressed" shows compact inline layout.
     * @default "default"
     */
    variant?: 'default' | 'compressed'
    /**
     * Currency code for formatting the price.
     * @default "EUR"
     */
    currency?: string
  }
}

/**
 * A payment confirmation card with product image, price, delivery info, and tracking button.
 * Supports two variants: default (detailed with header) and compressed (compact inline).
 *
 * Features:
 * - Success checkmark with "Payment confirmed" header
 * - Order ID reference
 * - Product image and description (default variant only)
 * - Price and delivery date display
 * - Track order button
 * - Responsive mobile/desktop layouts
 *
 * @component
 * @example
 * ```tsx
 * <PaymentConfirmed
 *   data={{
 *     orderId: "ORD-2024-5678",
 *     productName: "Running Shoes",
 *     productDescription: "Nike · Size 10 · Black",
 *     productImage: "/images/shoes.jpg",
 *     price: 129.99,
 *     deliveryDate: "Wed. Jan 18"
 *   }}
 *   actions={{
 *     onTrackOrder: () => console.log("Track order clicked")
 *   }}
 *   appearance={{ variant: "default", currency: "USD" }}
 * />
 * ```
 */
export function PaymentConfirmed({ data, actions, appearance }: PaymentConfirmedProps) {
  const resolved: NonNullable<PaymentConfirmedProps['data']> = data ?? demoPaymentConfirmed
  const orderId = resolved?.orderId
  const productName = resolved?.productName
  const productDescription = resolved?.productDescription
  const productImage = resolved?.productImage
  const price = resolved?.price
  const deliveryDate = resolved?.deliveryDate
  const { onTrackOrder } = actions ?? {}
  const { variant = 'default', currency = 'EUR' } = appearance ?? {}

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency
    }).format(value)
  }

  // Compressed variant - compact inline layout
  if (variant === 'compressed') {
    return (
      <div className="w-full rounded-lg bg-card border">
        {/* Mobile layout */}
        <div className="sm:hidden p-4 space-y-4">
          {/* Success icon and title */}
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-foreground">
              <Check className="h-5 w-5 text-background" />
            </div>
            <p className="font-semibold text-base">Payment confirmed</p>
          </div>

          {/* Product image centered */}
          <div className="flex justify-center">
            <div className="h-20 w-20 rounded-lg overflow-hidden bg-muted">
              {productImage ? (
                <img
                  src={productImage}
                  alt={productName ?? 'Product image'}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full bg-muted" />
              )}
            </div>
          </div>

          {/* Product info stacked */}
          <div className="text-center space-y-1">
            {productName && <p className="font-medium text-sm">{productName}</p>}
            {orderId && <p className="text-xs text-muted-foreground">Order #{orderId}</p>}
          </div>

          {/* Price and delivery */}
          {(price !== undefined || deliveryDate) && (
            <div className="flex items-center justify-between py-3 border-y">
              {price !== undefined && (
                <div>
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-lg font-semibold">{formatCurrency(price)}</p>
                </div>
              )}
              {deliveryDate && (
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Delivery</p>
                  <p className="text-sm font-medium">{deliveryDate}</p>
                </div>
              )}
            </div>
          )}

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
                alt={productName ?? 'Product image'}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full bg-muted" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {productName && <span className="font-medium text-sm truncate">{productName}</span>}
              {orderId && <span className="text-xs text-muted-foreground">#{orderId}</span>}
            </div>
            {deliveryDate && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Delivery: {deliveryDate}</span>
              </div>
            )}
          </div>
          {price !== undefined && (
            <div className="text-right flex-shrink-0">
              <p className="font-semibold">{formatCurrency(price)}</p>
            </div>
          )}
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

  // Default variant - detailed layout with header
  return (
    <div className="w-full rounded-lg bg-card border overflow-hidden">
      {/* Mobile layout */}
      <div className="sm:hidden">
        {/* Header */}
        <div className="flex flex-col items-center gap-1 px-3 py-3 bg-muted border-b">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground">
            <Check className="h-4 w-4 text-background" />
          </div>
          <span className="text-sm font-medium">
            Payment confirmed
          </span>
          {orderId && (
            <span className="text-xs text-muted-foreground">
              #{orderId}
            </span>
          )}
        </div>
        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Product image centered */}
          {productImage && (
            <div className="flex justify-center">
              <div className="h-20 w-20 rounded-lg overflow-hidden bg-muted">
                <img
                  src={productImage}
                  alt={productName ?? 'Product image'}
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
          )}
          {/* Product details stacked */}
          <div className="text-center space-y-1">
            {productName && <p className="text-base font-medium">{productName}</p>}
            {productDescription && <p className="text-sm text-muted-foreground">{productDescription}</p>}
          </div>
          {/* Price and delivery */}
          {(price !== undefined || deliveryDate) && (
            <div className="flex items-center justify-between py-3 border-y">
              {price !== undefined && (
                <div>
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-lg font-semibold">{formatCurrency(price)}</p>
                </div>
              )}
              {deliveryDate && (
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Delivery</p>
                  <p className="text-sm font-medium">{deliveryDate}</p>
                </div>
              )}
            </div>
          )}
          <Button variant="outline" size="sm" className="w-full" onClick={onTrackOrder}>
            Track order
            <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Desktop layout */}
      <div className="hidden sm:block">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-2 bg-muted border-b">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-foreground flex-shrink-0">
            <Check className="h-3 w-3 text-background" />
          </div>
          <span className="text-sm font-medium">
            Payment confirmed
          </span>
          {orderId && (
            <span className="text-xs text-muted-foreground ml-auto">
              #{orderId}
            </span>
          )}
        </div>
        {/* Product info */}
        <div className="p-4">
          <div className="flex gap-4">
            <div className="h-20 w-20 flex-shrink-0 rounded-lg overflow-hidden bg-muted">
              {productImage ? (
                <img
                  src={productImage}
                  alt={productName ?? 'Product image'}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full bg-muted" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              {productName && <p className="text-base font-medium truncate">{productName}</p>}
              {productDescription && <p className="text-sm text-muted-foreground">{productDescription}</p>}
              <div className="flex items-center justify-between mt-2">
                {price !== undefined && <span className="text-lg font-semibold">{formatCurrency(price)}</span>}
                {deliveryDate && (
                  <span className="text-sm text-muted-foreground">
                    Delivery: {deliveryDate}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t flex justify-end">
            <Button variant="outline" size="sm" onClick={onTrackOrder}>
              Track order
              <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
