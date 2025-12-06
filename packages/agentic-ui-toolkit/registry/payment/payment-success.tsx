"use client"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { CheckCircle2, MapPin, Mail, Package } from "lucide-react"

export interface PaymentSuccessProps {
  orderId?: string
  productName?: string
  price?: number
  currency?: string
  deliveryDate?: string
  deliveryAddress?: string
  email?: string
  onTrackOrder?: () => void
  onNeedHelp?: () => void
  onBackToShop?: () => void
}

export function PaymentSuccess({
  orderId = "ORD-2024-7842",
  productName = "AirPods Pro (2nd gen.)",
  price = 279.0,
  currency = "EUR",
  deliveryDate = "Tuesday Dec 10",
  deliveryAddress = "123 Main Street, 10001 New York",
  email = "john@example.com",
  onTrackOrder,
  onNeedHelp,
  onBackToShop,
}: PaymentSuccessProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(value)
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center pb-4">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
          <CheckCircle2 className="h-10 w-10 text-green-500" />
        </div>
        <h2 className="text-xl font-semibold">Payment confirmed!</h2>
        <p className="text-sm text-muted-foreground">Order #{orderId}</p>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            <Package className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">{productName}</span>
          </div>
          <span className="text-sm font-medium">{formatCurrency(price)}</span>
        </div>

        <Separator />

        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-sm font-medium">Expected delivery</p>
              <p className="text-sm text-muted-foreground">{deliveryDate}</p>
              <p className="text-sm text-muted-foreground">{deliveryAddress}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Mail className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-sm font-medium">Confirmation sent to</p>
              <p className="text-sm text-muted-foreground">{email}</p>
            </div>
          </div>
        </div>

        <Button className="w-full" variant="outline" onClick={onTrackOrder}>
          <Package className="mr-2 h-4 w-4" />
          Track my order
        </Button>
      </CardContent>

      <CardFooter className="flex justify-center gap-4 pt-2">
        <button
          onClick={onNeedHelp}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Need help?
        </button>
        <span className="text-muted-foreground">|</span>
        <button
          onClick={onBackToShop}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Back to shop
        </button>
      </CardFooter>
    </Card>
  )
}
