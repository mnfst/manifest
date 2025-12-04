"use client"

import { Button } from "@/components/ui/button"
import { CheckCircle2, ExternalLink } from "lucide-react"

export interface InlinePaymentConfirmedProps {
  orderId?: string
  productName?: string
  productDescription?: string
  productImage?: string
  price?: number
  currency?: string
  deliveryDate?: string
  onTrackOrder?: () => void
}

export function InlinePaymentConfirmed({
  orderId = "ORD-2024-7842",
  productName = "Air Force 1 '07",
  productDescription = "Nike · Size 42 · White",
  productImage = "/demo/shoe-1.png",
  price = 119,
  currency = "EUR",
  deliveryDate = "Tue. Dec 10",
  onTrackOrder,
}: InlinePaymentConfirmedProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(value)
  }

  return (
    <div className="w-full rounded-lg border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 bg-green-500/10 border-b border-green-500/20">
        <CheckCircle2 className="h-4 w-4 text-green-500" />
        <span className="text-sm font-medium text-green-700 dark:text-green-400">
          Payment confirmed
        </span>
        <span className="text-xs text-muted-foreground ml-auto">#{orderId}</span>
      </div>
      <div className="p-4">
        <div className="flex gap-4">
          <div className="h-20 w-20 flex-shrink-0 rounded-lg overflow-hidden bg-muted/30">
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
            <p className="font-medium">{productName}</p>
            <p className="text-sm text-muted-foreground">{productDescription}</p>
            <div className="flex items-center justify-between mt-2">
              <span className="text-lg font-semibold">{formatCurrency(price)}</span>
              <span className="text-sm text-muted-foreground">
                Delivery: {deliveryDate}
              </span>
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
  )
}
