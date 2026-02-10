"use client"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Package, Percent, Truck } from "lucide-react"

// Import types from shared types file to avoid circular dependencies
import type { OrderItem } from './types'
// Re-export for backward compatibility
export type { OrderItem } from './types'

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * OrderSummaryProps
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Props for an order summary component displaying items, totals, and discounts.
 * Shows itemized breakdown with subtotal, shipping, tax, and total.
 */
export interface OrderSummaryProps {
  data?: {
    /** Array of items in the order with id, name, quantity, price, and optional image. */
    items?: OrderItem[]
    /** Subtotal amount before shipping, tax, and discounts. */
    subtotal?: number
    /** Shipping cost. Displays "Free" when set to 0. */
    shipping?: number
    /** Tax amount to add to the order. */
    tax?: number
    /** Discount amount to subtract from the order. */
    discount?: number
    /** The discount code that was applied (displayed as a badge). */
    discountCode?: string
    /** Final total amount after all adjustments. */
    total?: number
  }
  appearance?: {
    /**
     * Currency code for formatting all monetary values.
     * @default "USD"
     */
    currency?: string
  }
}

/**
 * An order summary component displaying items, totals, and discounts.
 * Shows itemized breakdown with subtotal, shipping, tax, and total.
 *
 * Features:
 * - Line item display with images and quantities
 * - Subtotal, shipping, and tax breakdown
 * - Discount code display with badge
 * - Formatted currency display
 * - Responsive card layout
 *
 * @component
 * @example
 * ```tsx
 * <OrderSummary
 *   data={{
 *     items: [{ id: "1", name: "Product", quantity: 2, price: 29.99 }],
 *     subtotal: 59.98,
 *     shipping: 5.99,
 *     tax: 4.80,
 *     discount: 10,
 *     discountCode: "SAVE10",
 *     total: 60.77
 *   }}
 *   appearance={{ currency: "USD" }}
 * />
 * ```
 */
export function OrderSummary({ data, appearance }: OrderSummaryProps) {
  const {
    items,
    subtotal,
    shipping,
    tax,
    discount,
    discountCode,
    total,
  } = data ?? {}
  const { currency } = appearance ?? {}
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
    }).format(value)
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Order Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {items && items.length > 0 && (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.name || 'Item'}
                      className="h-12 w-12 rounded-md object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-md bg-muted">
                      <Package className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div>
                    {item.name && <p className="text-sm font-medium">{item.name}</p>}
                    {item.quantity !== undefined && (
                      <p className="text-sm text-muted-foreground">
                        Qty: {item.quantity}
                      </p>
                    )}
                  </div>
                </div>
                {item.price !== undefined && item.quantity !== undefined && (
                  <p className="text-sm font-medium">
                    {formatCurrency(item.price * item.quantity)}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {(subtotal !== undefined || shipping !== undefined || tax !== undefined || discount !== undefined) && (
          <>
            <Separator />

            <div className="space-y-2">
              {subtotal !== undefined && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
              )}
              {shipping !== undefined && (
                <div className="flex justify-between text-sm">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Truck className="h-4 w-4" />
                    Shipping
                  </span>
                  <span>{shipping === 0 ? "Free" : formatCurrency(shipping)}</span>
                </div>
              )}
              {tax !== undefined && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax</span>
                  <span>{formatCurrency(tax)}</span>
                </div>
              )}
              {discount !== undefined && discount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Percent className="h-4 w-4" />
                    Discount
                    {discountCode && (
                      <Badge variant="secondary" className="ml-1 text-xs">
                        {discountCode}
                      </Badge>
                    )}
                  </span>
                  <span className="text-foreground">-{formatCurrency(discount)}</span>
                </div>
              )}
            </div>
          </>
        )}

        {total !== undefined && (
          <>
            <Separator />

            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <span className="text-lg">{formatCurrency(total)}</span>
            </div>
          </>
        )}
      </CardContent>
      <CardFooter>
        <p className="text-xs text-muted-foreground">
          By completing this purchase you agree to our Terms of Service and
          Privacy Policy.
        </p>
      </CardFooter>
    </Card>
  )
}
