'use client'

import { Button } from '@/components/ui/button'
import { Check, ExternalLink } from 'lucide-react'

/*
 * PaymentConfirmed Component - ChatGPT UI Guidelines Compliant
 * - Use system colors (foreground/background) instead of custom green
 * - Single CTA action (Track order)
 * - Proper visual hierarchy
 * - No nested scrolling
 */

export interface PaymentConfirmedProps {
  orderId?: string
  productName?: string
  productDescription?: string
  productImage?: string
  price?: number
  currency?: string
  deliveryDate?: string
  onTrackOrder?: () => void
}

export function PaymentConfirmed({
  orderId = 'ORD-2024-7842',
  productName = "Air Force 1 '07",
  productDescription = 'Nike · Size 42 · White',
  productImage = '/demo/shoe-1.png',
  price = 119,
  currency = 'EUR',
  deliveryDate = 'Tue. Dec 10',
  onTrackOrder
}: PaymentConfirmedProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency
    }).format(value)
  }

  return (
    <div className="w-full rounded-lg bg-card border overflow-hidden">
      {/* Mobile layout */}
      <div className="sm:hidden">
        {/* Header */}
        <div className="flex flex-col items-center gap-1 px-3 py-3 bg-muted border-b">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground">
            <Check className="h-4 w-4 text-background" />
          </div>
          <span className="text-sm font-medium">
            Payment confirmed
          </span>
          <span className="text-xs text-muted-foreground">
            #{orderId}
          </span>
        </div>
        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Product image centered */}
          <div className="flex justify-center">
            <div className="h-20 w-20 rounded-lg overflow-hidden bg-muted">
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
          {/* Product details stacked */}
          <div className="text-center space-y-1">
            <p className="text-base font-medium">{productName}</p>
            <p className="text-sm text-muted-foreground">{productDescription}</p>
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
          <Button variant="outline" size="sm" className="w-full" onClick={onTrackOrder}>
            Track order
            <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Desktop layout */}
      <div className="hidden sm:block">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-2 bg-muted border-b">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-foreground flex-shrink-0">
            <Check className="h-3 w-3 text-background" />
          </div>
          <span className="text-sm font-medium">
            Payment confirmed
          </span>
          <span className="text-xs text-muted-foreground ml-auto">
            #{orderId}
          </span>
        </div>
        {/* Product info */}
        <div className="p-4">
          <div className="flex gap-4">
            <div className="h-20 w-20 flex-shrink-0 rounded-lg overflow-hidden bg-muted">
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
              <p className="text-base font-medium truncate">{productName}</p>
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
    </div>
  )
}
