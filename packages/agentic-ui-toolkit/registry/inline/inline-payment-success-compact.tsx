"use client"

import { Button } from "@/components/ui/button"
import { CheckCircle2, ExternalLink } from "lucide-react"

export interface InlinePaymentSuccessCompactProps {
  orderId?: string
  productName?: string
  productImage?: string
  price?: number
  currency?: string
  deliveryDate?: string
  onTrackOrder?: () => void
}

export function InlinePaymentSuccessCompact({
  orderId = "ORD-2024-7842",
  productName = "Air Force 1 '07",
  productImage = "/demo/shoe-1.png",
  price = 119,
  currency = "EUR",
  deliveryDate = "Tue. Dec 10",
  onTrackOrder,
}: InlinePaymentSuccessCompactProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(value)
  }

  return (
    <div className="w-full flex items-center gap-3 rounded-lg border bg-card px-3 py-2">
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-green-500/10">
        <CheckCircle2 className="h-5 w-5 text-green-500" />
      </div>
      <div className="h-10 w-10 flex-shrink-0 rounded-md overflow-hidden bg-muted/30">
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
  )
}
