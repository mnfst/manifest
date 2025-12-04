"use client"

import { Button } from "@/components/ui/button"
import { CheckCircle2, Calendar, Mail, ExternalLink } from "lucide-react"

export interface InlinePaymentSuccessProps {
  orderId?: string
  productName?: string
  price?: number
  currency?: string
  deliveryDate?: string
  email?: string
  brandName?: string
  brandLogo?: string
  onTrackOrder?: () => void
}

export function InlinePaymentSuccess({
  orderId = "ORD-2024-7842",
  productName = "AirPods Pro (2nd gen.)",
  price = 279.0,
  currency = "EUR",
  deliveryDate = "Tue. Dec 10",
  email = "john@example.com",
  brandName = "TechStore",
  brandLogo,
  onTrackOrder,
}: InlinePaymentSuccessProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(value)
  }

  return (
    <div className="w-full space-y-3">
      <div className="rounded-lg border bg-card">
        <div className="flex items-center gap-3 border-b p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-foreground/10">
            <CheckCircle2 className="h-6 w-6 text-foreground" />
          </div>
          <div>
            <h3 className="font-semibold">Payment confirmed!</h3>
            <p className="text-sm text-muted-foreground">
              Order #{orderId}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between border-b p-4">
          <span className="text-sm">{productName}</span>
          <span className="font-medium">{formatCurrency(price)}</span>
        </div>

        <div className="flex flex-col gap-1.5 p-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5" />
            <span>Delivery: {deliveryDate}</span>
          </div>
          <div className="flex items-center gap-2">
            <Mail className="h-3.5 w-3.5" />
            <span>Confirmation sent to {email}</span>
          </div>
        </div>

        <div className="p-4 pt-0">
          <Button
            variant="secondary"
            className="w-full"
            onClick={onTrackOrder}
          >
            {brandLogo ? (
              <img src={brandLogo} alt={brandName} className="mr-2 h-4 w-4" />
            ) : (
              <div className="mr-2 flex h-5 w-5 items-center justify-center rounded bg-primary text-[10px] font-bold text-primary-foreground">
                {brandName?.charAt(0) || "T"}
              </div>
            )}
            Track my order
            <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
