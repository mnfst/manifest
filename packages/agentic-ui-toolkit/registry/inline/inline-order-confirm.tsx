'use client'

import { Button } from '@/components/ui/button'
import { ArrowRight, Calendar, MapPin } from 'lucide-react'

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
  'https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/MQD83?wid=400&hei=400&fmt=jpeg&qlt=95'

export function InlineOrderConfirm({
  productName = 'AirPods Pro 2',
  productVariant = 'White',
  productImage = DEFAULT_AIRPODS_IMAGE,
  quantity = 1,
  price = 249.0,
  currency = 'USD',
  deliveryDate = 'Tue. Dec 10',
  deliveryAddress = '123 Main Street, 10001',
  freeShipping = true,
  onConfirm,
  isLoading = false
}: InlineOrderConfirmProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency
    }).format(value)
  }

  return (
    <div className="w-full rounded-md sm:rounded-lg bg-card">
      {/* Product info */}
      <div className="flex items-start gap-3 p-3 sm:gap-4 sm:p-2">
        <img
          src={productImage}
          alt={productName}
          className="h-12 w-12 sm:h-16 sm:w-16 rounded-md sm:rounded-lg object-contain bg-muted/30"
        />
        <div className="flex-1 min-w-0">
          {/* Mobile: stacked layout */}
          <h3 className="text-sm sm:text-base font-medium truncate">
            {productName}
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {productVariant} • Qty: {quantity}
          </p>
          {/* Mobile: price below product info */}
          <div className="mt-1 sm:hidden">
            <p className="text-sm font-semibold">{formatCurrency(price)}</p>
            {freeShipping && (
              <p className="text-xs text-green-600">Free shipping</p>
            )}
          </div>
        </div>
        {/* Desktop: price on the right */}
        <div className="hidden sm:block text-right">
          <p className="font-semibold">{formatCurrency(price)}</p>
          {freeShipping && (
            <p className="text-sm text-green-600">Free shipping</p>
          )}
        </div>
      </div>

      <div className="border-t" />

      {/* Delivery info & button */}
      <div className="p-3 space-y-3 sm:py-2 sm:pr-2 sm:pl-4 sm:space-y-0 sm:flex sm:items-center sm:justify-between">
        {/* Mobile: stacked, Desktop: inline */}
        <div className="space-y-1.5 sm:space-y-0 sm:flex sm:flex-wrap sm:items-center sm:gap-2 text-xs sm:text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
            <span>{deliveryDate}</span>
          </div>
          <span className="hidden sm:inline">•</span>
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
            <span className="truncate">{deliveryAddress}</span>
          </div>
        </div>

        <Button
          size="sm"
          className="w-full sm:w-auto"
          onClick={onConfirm}
          disabled={isLoading}
        >
          {isLoading ? 'Confirming...' : 'Confirm order'}
          <ArrowRight className="ml-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </Button>
      </div>
    </div>
  )
}
