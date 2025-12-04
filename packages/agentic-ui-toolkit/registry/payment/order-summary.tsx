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

export interface OrderItem {
  id: string
  name: string
  quantity: number
  price: number
  image?: string
}

export interface OrderSummaryProps {
  items: OrderItem[]
  subtotal: number
  shipping?: number
  tax?: number
  discount?: number
  discountCode?: string
  total: number
  currency?: string
}

const defaultItems: OrderItem[] = [
  { id: "1", name: "Premium Headphones", quantity: 1, price: 199.99 },
  { id: "2", name: "Wireless Charger", quantity: 2, price: 29.99 },
]

const defaultProps: OrderSummaryProps = {
  items: defaultItems,
  subtotal: 259.97,
  shipping: 9.99,
  tax: 21.58,
  discount: 25.0,
  discountCode: "SAVE10",
  total: 266.54,
  currency: "USD",
}

export function OrderSummary({
  items = defaultProps.items,
  subtotal = defaultProps.subtotal,
  shipping = defaultProps.shipping,
  tax = defaultProps.tax,
  discount = defaultProps.discount,
  discountCode = defaultProps.discountCode,
  total = defaultProps.total,
  currency = "USD",
}: Partial<OrderSummaryProps>) {
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
            <div className="flex justify-between text-sm text-green-600">
              <span className="flex items-center gap-1">
                <Percent className="h-4 w-4" />
                Discount
                {discountCode && (
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {discountCode}
                  </Badge>
                )}
              </span>
              <span>-{formatCurrency(discount)}</span>
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
