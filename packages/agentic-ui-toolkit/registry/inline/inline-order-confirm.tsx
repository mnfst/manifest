"use client"

import { Button } from "@/components/ui/button"
import { ArrowRight, Calendar, MapPin } from "lucide-react"

export interface InlineOrderConfirmProps {
  productName?: string
  productVariant?: string
  productImage?: string
  quantity?: number
  price?: number
  currency?: string
  deliveryDate?: string
  deliveryAddress?: string
  freeShipping?: boolean
  onConfirm?: () => void
  isLoading?: boolean
}

const DEFAULT_AIRPODS_IMAGE =
  "https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/MQD83?wid=400&hei=400&fmt=jpeg&qlt=95"

export function InlineOrderConfirm({
  productName = "AirPods Pro (2nd gen.)",
  productVariant = "White",
  productImage = DEFAULT_AIRPODS_IMAGE,
  quantity = 1,
  price = 279.0,
  currency = "EUR",
  deliveryDate = "Tue. Dec 10",
  deliveryAddress = "123 Main Street, 10001",
  freeShipping = true,
  onConfirm,
  isLoading = false,
}: InlineOrderConfirmProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(value)
  }

  return (
    <div className="w-full space-y-3">
      <div className="flex items-start gap-4 rounded-lg border bg-card p-4">
        <img
          src={productImage}
          alt={productName}
          className="h-16 w-16 rounded-lg object-contain bg-white"
        />
        <div className="flex-1">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-medium">{productName}</h3>
              <p className="text-sm text-muted-foreground">
                {productVariant} • Qty: {quantity}
              </p>
            </div>
            <div className="text-right">
              <p className="font-semibold">{formatCurrency(price)}</p>
              {freeShipping && (
                <p className="text-sm text-green-600">Free shipping</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5" />
          {deliveryDate}
        </div>
        <span>•</span>
        <div className="flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5" />
          {deliveryAddress}
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={onConfirm} disabled={isLoading}>
          {isLoading ? "Confirming..." : "Confirm order"}
          <ArrowRight className="ml-1.5 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
