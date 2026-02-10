'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Minus, Plus, Info } from 'lucide-react'
import { useState } from 'react'
import { demoTicketTiers } from './demo/events'

/**
 * Formats a currency amount.
 * @param {number} amount - Amount to format
 * @param {string} currency - Currency code
 * @returns {string} Formatted currency string
 */
function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2
  }).format(amount)
}

/**
 * Represents a ticket tier option.
 * @interface TicketTier
 * @property {string} [name] - Tier name (e.g., "General Admission", "VIP")
 * @property {number} [price] - Base price
 * @property {number} [fee] - Service fee
 * @property {number} [available] - Number available
 * @property {string} [salesEndDate] - When sales end
 * @property {string} [description] - Tier description
 * @property {number} [maxPerOrder] - Maximum tickets per order
 */
export interface TicketTier {
  name?: string
  price?: number
  fee?: number
  available?: number
  salesEndDate?: string
  description?: string
  maxPerOrder?: number
}

/**
 * Represents a selected ticket with quantity.
 * @interface TicketSelection
 * @property {string} tierName - Tier name for display
 * @property {number} quantity - Number of tickets
 * @property {number} price - Base price per ticket
 * @property {number} fee - Fee per ticket
 */
export interface TicketSelection {
  tierName?: string
  quantity: number
  price?: number
  fee?: number
}

export interface TicketTierEvent {
  title?: string
  date?: string
  image?: string
  currency?: string
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TicketTierSelectProps
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Props for the TicketTierSelect component. Allows selection of multiple
 * ticket tiers with quantity pickers and displays an order summary.
 */
export interface TicketTierSelectProps {
  data?: {
    /** Event information including title, date, and currency. */
    event?: TicketTierEvent
    /** Available ticket tiers with pricing and availability. */
    tiers?: TicketTier[]
  }
  actions?: {
    /** Called when checkout button is clicked with selections and total. */
    onCheckout?: (selections: TicketSelection[], total: number) => void
  }
  appearance?: {
    /**
     * Whether to show the order summary sidebar.
     * @default true
     */
    showOrderSummary?: boolean
  }
  control?: {
    /** Initial ticket selections as a map of tier index to quantity. */
    selections?: Record<number, number>
  }
}

/**
 * A ticket tier selection component with quantity pickers and order summary.
 * Allows users to select quantities for multiple ticket tiers.
 *
 * Features:
 * - Multiple tier selection with quantities
 * - Price and fee breakdown
 * - Sales end date display
 * - Tier descriptions
 * - Order summary sidebar
 * - Checkout button
 *
 * @component
 * @example
 * ```tsx
 * <TicketTierSelect
 *   data={{
 *     event: {
 *       title: "Concert Night",
 *       date: "Friday, Feb 6 · 8pm",
 *       currency: "USD"
 *     },
 *     tiers: [
 *       { name: "General Admission", price: 45, fee: 5, available: 100 },
 *       { name: "VIP", price: 120, fee: 10, available: 50 }
 *     ]
 *   }}
 *   actions={{
 *     onCheckout: (selections, total) => console.log("Checkout:", total),
 *     onSelectionChange: (selections) => console.log("Selections:", selections)
 *   }}
 *   appearance={{ showOrderSummary: true }}
 * />
 * ```
 */
export function TicketTierSelect({ data, actions, appearance, control }: TicketTierSelectProps) {
  const resolved: NonNullable<TicketTierSelectProps['data']> = data ?? { tiers: demoTicketTiers }
  const event = resolved.event
  const tiers = resolved.tiers ?? []
  const currency = event?.currency ?? 'USD'
  const { onCheckout } = actions ?? {}
  const { showOrderSummary = true } = appearance ?? {}

  const [selections, setSelections] = useState<Record<number, number>>(
    control?.selections ?? {}
  )

  const updateQuantity = (tierIndex: number, delta: number) => {
    const tier = tiers[tierIndex]
    if (!tier) return

    const currentQty = selections[tierIndex] || 0
    const newQty = Math.max(0, Math.min(currentQty + delta, tier.maxPerOrder ?? 10, tier.available ?? 100))

    const newSelections = { ...selections, [tierIndex]: newQty }
    if (newQty === 0) {
      delete newSelections[tierIndex]
    }
    setSelections(newSelections)
  }

  const getSelectionsList = (sels: Record<number, number> = selections): TicketSelection[] => {
    return Object.entries(sels)
      .filter(([_, qty]) => qty > 0)
      .map(([indexStr, qty]) => {
        const tierIndex = parseInt(indexStr, 10)
        const tier = tiers[tierIndex]
        return {
          tierName: tier?.name,
          quantity: qty,
          price: tier?.price,
          fee: tier?.fee ?? 0
        }
      })
  }

  const selectionsList = getSelectionsList()
  const hasSelections = selectionsList.length > 0

  const subtotal = selectionsList.reduce((sum, s) => sum + (s.price ?? 0) * s.quantity, 0)
  const totalFees = selectionsList.reduce((sum, s) => sum + (s.fee ?? 0) * s.quantity, 0)
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
        {(event?.title || event?.date) && (
          <div className="text-center mb-6">
            {event?.title && <h2 className="text-xl font-semibold">{event.title}</h2>}
            {event?.date && <p className="text-sm text-muted-foreground mt-1">{event.date}</p>}
          </div>
        )}

        {/* Tiers */}
        <div className="space-y-4">
          {tiers.map((tier, index) => {
            const qty = selections[index] || 0
            const isSelected = qty > 0
            const totalPrice = (tier.price ?? 0) + (tier.fee ?? 0)

            return (
              <div
                key={index}
                className={cn(
                  'rounded-lg border p-4 transition-colors',
                  isSelected && 'border-primary ring-1 ring-primary'
                )}
              >
                {/* Tier header */}
                <div className="flex items-center justify-between">
                  {tier.name && <h3 className="font-medium">{tier.name}</h3>}
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="icon"
                      className={cn(
                        'h-8 w-8 rounded-full',
                        qty === 0 && 'opacity-50'
                      )}
                      onClick={() => updateQuantity(index, -1)}
                      disabled={qty === 0}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-6 text-center font-medium">{qty}</span>
                    <Button
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      onClick={() => updateQuantity(index, 1)}
                      disabled={qty >= (tier.maxPerOrder ?? 10) || qty >= (tier.available ?? 100)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Price info */}
                {tier.price !== undefined && (
                  <div className="mt-3">
                    <div className="flex items-baseline gap-2">
                      <span className="font-semibold">{formatCurrency(totalPrice, currency)}</span>
                      {(tier.fee ?? 0) > 0 && (
                        <span className="text-sm text-muted-foreground">
                          incl. {formatCurrency(tier.fee ?? 0, currency)} Fee
                        </span>
                      )}
                    </div>
                    {tier.salesEndDate && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Sales end on {tier.salesEndDate}
                      </p>
                    )}
                  </div>
                )}

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
            {event?.image && (
              <img
                src={event.image}
                alt={event?.title || 'Event image'}
                className="w-full h-40 object-cover rounded-lg mb-4"
              />
            )}

            <div className="rounded-lg border bg-muted/30 p-4">
              <h3 className="font-semibold mb-4">Order summary</h3>

              {hasSelections ? (
                <>
                  {/* Line items */}
                  <div className="space-y-2">
                    {selectionsList.map((selection, index) => (
                      <div key={index} className="flex justify-between text-sm">
                        <span>{selection.quantity} x {selection.tierName ?? 'Ticket'}</span>
                        <span>{formatCurrency((selection.price ?? 0) * selection.quantity, currency)}</span>
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
