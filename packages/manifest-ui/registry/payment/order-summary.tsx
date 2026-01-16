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
import { demoOrderData } from './demo/data'

/**
 * Represents an item in the order.
 * @interface OrderItem
 * @property {string} id - Unique item identifier
 * @property {string} name - Item name
 * @property {number} quantity - Quantity ordered
 * @property {number} price - Price per item
 * @property {string} [image] - Product image URL
 */
export interface OrderItem {
  id: string
  name: string
  quantity: number
  price: number
  image?: string
}

/**
 * Props for the OrderSummary component.
 * @interface OrderSummaryProps
 * @property {object} [data] - Order data
 * @property {OrderItem[]} [data.items] - Order items
 * @property {number} [data.subtotal] - Subtotal amount
 * @property {number} [data.shipping] - Shipping cost
 * @property {number} [data.tax] - Tax amount
 * @property {number} [data.discount] - Discount amount
 * @property {string} [data.discountCode] - Applied discount code
 * @property {number} [data.total] - Total amount
 * @property {object} [appearance] - Visual customization
 * @property {string} [appearance.currency] - Currency code (default: USD)
 */
export interface OrderSummaryProps {
  /** Content and data to display */
  data?: {
    items?: OrderItem[]
    subtotal?: number
    shipping?: number
    tax?: number
    discount?: number
    discountCode?: string
    total?: number
  }
  /** Visual configuration options */
  appearance?: {
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
    items = demoOrderData.items,
    subtotal = demoOrderData.subtotal,
    shipping = demoOrderData.shipping,
    tax = demoOrderData.tax,
    discount = demoOrderData.discount,
    discountCode = demoOrderData.discountCode,
    total = demoOrderData.total,
  } = data ?? {}
  const { currency = "USD" } = appearance ?? {}
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
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
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.name}
                    className="h-12 w-12 rounded-md object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-md bg-muted">
                    <Package className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium">{item.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Qty: {item.quantity}
                  </p>
                </div>
              </div>
              <p className="text-sm font-medium">
                {formatCurrency(item.price * item.quantity)}
              </p>
            </div>
          ))}
        </div>

        <Separator />

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
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

        <Separator />

        <div className="flex justify-between font-semibold">
          <span>Total</span>
          <span className="text-lg">{formatCurrency(total)}</span>
        </div>
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
