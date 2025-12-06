"use client"

import { Button } from "@/components/ui/button"
import { CheckCircle2, ExternalLink } from "lucide-react"

export interface InlinePaymentSuccessProps {
  orderId?: string
  productName?: string
  price?: number
  currency?: string
  deliveryDate?: string
  email?: string
  onTrackOrder?: () => void
}

export function InlinePaymentSuccess({
  orderId = "ORD-2024-7842",
  productName = "AirPods Pro (2nd gen.)",
  price = 279.0,
  currency = "EUR",
  deliveryDate = "Tue. Dec 10",
  email = "john@example.com",
  onTrackOrder,
}: InlinePaymentSuccessProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(value)
  }

  return (
    <div className="w-full flex items-center justify-between gap-4 rounded-lg border bg-card px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10">
          <CheckCircle2 className="h-5 w-5 text-green-500" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold">Payment confirmed!</span>
            <span className="text-sm text-muted-foreground">#{orderId}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{productName}</span>
            <span>•</span>
            <span>Delivery: {deliveryDate}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-lg font-semibold">{formatCurrency(price)}</p>
          <p className="text-xs text-muted-foreground">Total paid</p>
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={onTrackOrder}
      >
        Track order
        <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
      </Button>
    </div>
  )
}
