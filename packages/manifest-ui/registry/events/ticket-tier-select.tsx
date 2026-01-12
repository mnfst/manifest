'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Minus, Plus, Info } from 'lucide-react'
import { useState } from 'react'

// Format number with commas (consistent across server/client)
function formatNumber(num: number): string {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

// Format currency
function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2
  }).format(amount)
}

export interface TicketTier {
  id: string
  name: string
  price: number
  fee: number
  available: number
  salesEndDate?: string
  description?: string
  maxPerOrder?: number
}

export interface TicketSelection {
  tierId: string
  tierName: string
  quantity: number
  price: number
  fee: number
}

const defaultTiers: TicketTier[] = [
  {
    id: 'general',
    name: 'General Admission',
    price: 21.75,
    fee: 3.30,
    available: 100,
    salesEndDate: 'Feb 6, 2026',
    maxPerOrder: 10
  },
  {
    id: 'vip',
    name: 'VIP',
    price: 35.85,
    fee: 4.25,
    available: 50,
    salesEndDate: 'Feb 6, 2026',
    description: 'VIP tickets include entrance into Player Play Date for one person/ticket and a customized Player Play Date tote bag.',
    maxPerOrder: 5
  }
]

export interface TicketTierEvent {
  title: string
  date: string
  image?: string
  currency?: string
}

const defaultEvent: TicketTierEvent = {
  title: 'Player Play Date',
  date: 'Friday, February 6 · 2 - 5pm PST',
  currency: 'USD'
}

export interface TicketTierSelectProps {
  data?: {
    event?: TicketTierEvent
    tiers?: TicketTier[]
  }
  actions?: {
    onCheckout?: (selections: TicketSelection[], total: number) => void
    onSelectionChange?: (selections: TicketSelection[]) => void
  }
  appearance?: {
    showOrderSummary?: boolean
  }
  control?: {
    selections?: Record<string, number>
  }
}

export function TicketTierSelect({ data, actions, appearance, control }: TicketTierSelectProps) {
  const {
    event = defaultEvent,
    tiers = defaultTiers
  } = data ?? {}
  const currency = event.currency ?? 'USD'
  const { onCheckout, onSelectionChange } = actions ?? {}
  const { showOrderSummary = true } = appearance ?? {}

  const [selections, setSelections] = useState<Record<string, number>>(
    control?.selections ?? {}
  )

  const updateQuantity = (tierId: string, delta: number) => {
    const tier = tiers.find(t => t.id === tierId)
    if (!tier) return

    const currentQty = selections[tierId] || 0
    const newQty = Math.max(0, Math.min(currentQty + delta, tier.maxPerOrder ?? 10, tier.available))

    const newSelections = { ...selections, [tierId]: newQty }
    if (newQty === 0) {
      delete newSelections[tierId]
    }
    setSelections(newSelections)

    // Notify parent of selection change
    const selectionsList = getSelectionsList(newSelections)
    onSelectionChange?.(selectionsList)
  }

  const getSelectionsList = (sels: Record<string, number> = selections): TicketSelection[] => {
    return Object.entries(sels)
      .filter(([_, qty]) => qty > 0)
      .map(([tierId, qty]) => {
        const tier = tiers.find(t => t.id === tierId)!
        return {
          tierId,
          tierName: tier.name,
          quantity: qty,
          price: tier.price,
          fee: tier.fee
        }
      })
  }

  const selectionsList = getSelectionsList()
  const hasSelections = selectionsList.length > 0

  const subtotal = selectionsList.reduce((sum, s) => sum + s.price * s.quantity, 0)
  const totalFees = selectionsList.reduce((sum, s) => sum + s.fee * s.quantity, 0)
  const total = subtotal + totalFees

  const handleCheckout = () => {
    onCheckout?.(selectionsList, total)
  }

  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left side - Tier selection */}
        <div className="flex-1">
        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-xl font-semibold">{event.title}</h2>
          <p className="text-sm text-muted-foreground mt-1">{event.date}</p>
        </div>

        {/* Tiers */}
        <div className="space-y-4">
          {tiers.map((tier) => {
            const qty = selections[tier.id] || 0
            const isSelected = qty > 0
            const totalPrice = tier.price + tier.fee

            return (
              <div
                key={tier.id}
                className={cn(
                  'rounded-lg border p-4 transition-colors',
                  isSelected && 'border-primary ring-1 ring-primary'
                )}
              >
                {/* Tier header */}
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">{tier.name}</h3>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="icon"
                      className={cn(
                        'h-8 w-8 rounded-full',
                        qty === 0 && 'opacity-50'
                      )}
                      onClick={() => updateQuantity(tier.id, -1)}
                      disabled={qty === 0}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-6 text-center font-medium">{qty}</span>
                    <Button
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      onClick={() => updateQuantity(tier.id, 1)}
                      disabled={qty >= (tier.maxPerOrder ?? 10) || qty >= tier.available}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Price info */}
                <div className="mt-3">
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold">{formatCurrency(totalPrice, currency)}</span>
                    <span className="text-sm text-muted-foreground">
                      incl. {formatCurrency(tier.fee, currency)} Fee
                    </span>
                  </div>
                  {tier.salesEndDate && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Sales end on {tier.salesEndDate}
                    </p>
                  )}
                </div>

                {/* Description */}
                {tier.description && (
                  <p className="text-sm text-muted-foreground mt-3">
                    {tier.description}
                  </p>
                )}
              </div>
            )
          })}
        </div>

        {/* Checkout button */}
        <div className="mt-6">
          <Button
            className="w-full"
            size="lg"
            onClick={handleCheckout}
            disabled={!hasSelections}
          >
            Check out
          </Button>
        </div>
      </div>

        {/* Right side - Order summary */}
        {showOrderSummary && (
          <div className="w-full lg:w-80 shrink-0">
            {/* Event image */}
            {event.image && (
              <img
                src={event.image}
                alt={event.title}
                className="w-full h-40 object-cover rounded-lg mb-4"
              />
            )}

            <div className="rounded-lg border bg-muted/30 p-4">
              <h3 className="font-semibold mb-4">Order summary</h3>

              {hasSelections ? (
                <>
                  {/* Line items */}
                  <div className="space-y-2">
                    {selectionsList.map((selection) => (
                      <div key={selection.tierId} className="flex justify-between text-sm">
                        <span>{selection.quantity} x {selection.tierName}</span>
                        <span>{formatCurrency(selection.price * selection.quantity, currency)}</span>
                      </div>
                    ))}
                  </div>

                  {/* Totals */}
                  <div className="mt-4 pt-4 border-t space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Subtotal</span>
                      <span>{formatCurrency(subtotal, currency)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-1">
                        Fees
                        <Info className="h-3 w-3 text-muted-foreground" />
                      </span>
                      <span>{formatCurrency(totalFees, currency)}</span>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t">
                    <div className="flex justify-between font-semibold">
                      <span>Total</span>
                      <span>{formatCurrency(total, currency)}</span>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No tickets selected</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
