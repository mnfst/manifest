'use client'

import { Button } from '@/components/ui/button'
import { ArrowRight, Calendar, MapPin } from 'lucide-react'
import { demoOrderConfirm } from './demo/payment'

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * OrderConfirmProps
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Props for an order confirmation component with product image, delivery info,
 * and confirm action. Displays responsive layouts for mobile and desktop.
 */
export interface OrderConfirmProps {
  data?: {
    /** Name of the product being ordered. */
    productName?: string
    /** Product variant such as color or size. */
    productVariant?: string
    /** URL to the product image. */
    productImage?: string
    /**
     * Quantity of items being ordered.
     * @default 1
     */
    quantity?: number
    /** Total price for the order. */
    price?: number
    /** Expected delivery date string (e.g., "Tue. Dec 10"). */
    deliveryDate?: string
    /** Delivery address for the order. */
    deliveryAddress?: string
    /**
     * Whether shipping is free for this order.
     * @default true
     */
    freeShipping?: boolean
  }
  actions?: {
    /** Called when the user confirms the order. */
    onConfirm?: () => void
  }
  appearance?: {
    /**
     * Currency code for formatting the price.
     * @default "USD"
     */
    currency?: string
  }
  control?: {
    /**
     * Shows loading state on the confirm button.
     * @default false
     */
    isLoading?: boolean
  }
}

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
  const resolved: NonNullable<OrderConfirmProps['data']> = data ?? demoOrderConfirm
  const productName = resolved?.productName
  const productVariant = resolved?.productVariant
  const productImage = resolved?.productImage
  const quantity = resolved?.quantity ?? 1
  const price = resolved?.price
  const deliveryDate = resolved?.deliveryDate
  const deliveryAddress = resolved?.deliveryAddress
  const freeShipping = resolved?.freeShipping ?? true
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
        {productImage && (
          <img
            src={productImage}
            alt={productName ?? 'Product image'}
            className="h-12 w-12 sm:h-16 sm:w-16 rounded-sm sm:rounded-md object-contain bg-muted/30"
          />
        )}
        <div className="flex-1 min-w-0">
          {/* Mobile: stacked layout */}
          {productName && (
            <h3 className="text-sm sm:text-base font-medium truncate">
              {productName}
            </h3>
          )}
          {(productVariant || quantity) && (
            <p className="text-xs sm:text-sm text-muted-foreground">
              {productVariant}{productVariant && quantity ? ' • ' : ''}Qty: {quantity}
            </p>
          )}
          {/* Mobile: price below product info */}
          <div className="mt-1 sm:hidden">
            {price !== undefined && <p className="text-sm font-semibold">{formatCurrency(price)}</p>}
            {freeShipping && (
              <p className="text-xs text-green-600">Free shipping</p>
            )}
          </div>
        </div>
        {/* Desktop: price on the right */}
        <div className="hidden sm:block text-right">
          {price !== undefined && <p className="font-semibold">{formatCurrency(price)}</p>}
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
          {deliveryDate && (
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
              <span>{deliveryDate}</span>
            </div>
          )}
          {deliveryDate && deliveryAddress && <span className="hidden sm:inline">•</span>}
          {deliveryAddress && (
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
              <span className="truncate">{deliveryAddress}</span>
            </div>
          )}
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
