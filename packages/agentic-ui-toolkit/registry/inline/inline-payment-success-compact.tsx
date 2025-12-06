'use client'

import { Button } from '@/components/ui/button'
import { CheckCircle2, ExternalLink } from 'lucide-react'

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
  orderId = 'ORD-2024-7842',
  productName = "Air Force 1 '07",
  productImage = '/demo/shoe-1.png',
  price = 119,
  currency = 'EUR',
  deliveryDate = 'Tue. Dec 10',
  onTrackOrder
}: InlinePaymentSuccessCompactProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency
    }).format(value)
  }

  return (
    <div className="w-full rounded-lg bg-card">
      {/* Mobile layout */}
      <div className="sm:hidden p-4 space-y-4">
        {/* Success icon and title */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
            <CheckCircle2 className="h-6 w-6 text-green-500" />
          </div>
          <p className="font-semibold text-base">Payment successful</p>
        </div>

        {/* Product image centered */}
        <div className="flex justify-center">
          <div className="h-24 w-24 rounded-lg overflow-hidden bg-muted/30">
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
        </div>

        {/* Product info stacked */}
        <div className="text-center space-y-1">
          <p className="font-medium text-sm">{productName}</p>
          <p className="text-xs text-muted-foreground">Order #{orderId}</p>
        </div>

        {/* Price and delivery */}
        <div className="flex items-center justify-between py-3 border-y">
          <div>
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-lg font-semibold">{formatCurrency(price)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Delivery</p>
            <p className="text-sm font-medium">{deliveryDate}</p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onTrackOrder}
          className="w-full"
        >
          Track order
          <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Desktop layout - compact inline */}
      <div className="hidden sm:flex items-center gap-3 px-3 py-2">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-green-500/10">
          <CheckCircle2 className="h-5 w-5 text-green-500" />
        </div>
        <div className="h-10 w-10 flex-shrink-0 rounded overflow-hidden bg-muted/30">
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
    </div>
  )
}
