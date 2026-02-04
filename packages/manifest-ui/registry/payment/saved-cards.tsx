"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CreditCard, Plus, Check } from "lucide-react"

/**
 * Represents a saved payment card.
 * @interface SavedCard
 * @property {string} id - Unique identifier for the card
 * @property {"visa" | "mastercard" | "amex"} brand - Card brand/network
 * @property {string} last4 - Last 4 digits of the card number
 * @property {string} expiryMonth - Two-digit expiry month
 * @property {string} expiryYear - Two-digit expiry year
 * @property {boolean} [isDefault] - Whether this is the default payment method
 */
export interface SavedCard {
  id: string
  brand: "visa" | "mastercard" | "amex"
  last4?: string
  expiryMonth?: string
  expiryYear?: string
  isDefault?: boolean
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SavedCardsProps
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Props for a card selector component for choosing a saved payment method.
 * Supports multiple card brands with visual indicators and default card marking.
 */
export interface SavedCardsProps {
  data?: {
    /** Array of saved payment cards to display. */
    cards?: SavedCard[]
    /**
     * Amount to charge, displayed in the pay button.
     * @default 279.0
     */
    amount?: number
  }
  actions?: {
    /** Called when the user clicks the add new card option. */
    onAddNewCard?: () => void
    /** Called when the user initiates payment with the selected card. */
    onPay?: (cardId: string) => void
  }
  appearance?: {
    /**
     * Currency code for formatting the amount.
     * @default "EUR"
     */
    currency?: string
  }
  control?: {
    /** ID of the currently selected card. */
    selectedCardId?: string
    /**
     * Shows loading state on the pay button.
     * @default false
     */
    isLoading?: boolean
  }
}

const brandLogos: Record<string, string> = {
  visa: "VISA",
  mastercard: "MC",
  amex: "AMEX",
}

const brandColors: Record<string, string> = {
  visa: "bg-blue-600",
  mastercard: "bg-orange-500",
  amex: "bg-blue-400",
}

/**
 * A card selector component for choosing a saved payment method.
 * Supports multiple card brands with visual indicators and default card marking.
 *
 * Features:
 * - Visual card brand logos (Visa, Mastercard, Amex)
 * - Card selection with highlight and checkmark
 * - Default card indicator
 * - Add new card option
 * - Pay button with amount display
 * - Loading state support
 *
 * @component
 * @example
 * ```tsx
 * <SavedCards
 *   data={{
 *     cards: [
 *       { id: "1", brand: "visa", last4: "4242", expiryMonth: "12", expiryYear: "26", isDefault: true },
 *       { id: "2", brand: "mastercard", last4: "8888", expiryMonth: "03", expiryYear: "25" }
 *     ],
 *     amount: 99.99
 *   }}
 *   actions={{
 *     onSelectCard: (id) => console.log("Selected card:", id),
 *     onAddNewCard: () => console.log("Add new card"),
 *     onPay: (id) => console.log("Pay with card:", id)
 *   }}
 *   appearance={{ currency: "USD" }}
 *   control={{ isLoading: false }}
 * />
 * ```
 */
export function SavedCards({ data, actions, appearance, control }: SavedCardsProps) {
  const cards = data?.cards
  const amount = data?.amount
  const onAddNewCard = actions?.onAddNewCard
  const onPay = actions?.onPay
  const currency = appearance?.currency
  const selectedCardId = control?.selectedCardId
  const isLoading = control?.isLoading ?? false
  const [selected, setSelected] = useState(
    selectedCardId || cards?.find((c) => c.isDefault)?.id || cards?.[0]?.id
  )

  const handleSelect = (cardId: string) => {
    setSelected(cardId)
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
    }).format(value)
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Payment Method
        </CardTitle>
        <CardDescription>
          Select a saved card or add a new one
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {cards && cards.map((card) => (
          <button
            key={card.id}
            onClick={() => handleSelect(card.id)}
            className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
              selected === card.id
                ? "border-primary bg-primary/5 ring-1 ring-primary"
                : "border-border hover:border-primary/50 hover:bg-muted/50"
            }`}
          >
            <div
              className={`flex h-10 w-14 items-center justify-center rounded-md ${brandColors[card.brand]} text-white text-xs font-bold`}
            >
              {brandLogos[card.brand]}
            </div>
            <div className="flex-1 text-left">
              {card.last4 && (
                <p className="text-sm font-medium">
                  •••• •••• •••• {card.last4}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {card.expiryMonth && card.expiryYear && `Expires ${card.expiryMonth}/${card.expiryYear}`}
                {card.isDefault && (
                  <span className="ml-2 text-primary">• Default</span>
                )}
              </p>
            </div>
            {selected === card.id && (
              <Check className="h-5 w-5 text-primary" />
            )}
          </button>
        ))}

        <button
          onClick={onAddNewCard}
          className="w-full flex items-center gap-3 p-3 rounded-lg border border-dashed border-border hover:border-primary/50 hover:bg-muted/50 transition-all cursor-pointer"
        >
          <div className="flex h-10 w-14 items-center justify-center rounded-md bg-muted">
            <Plus className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            Add a new card
          </p>
        </button>
      </CardContent>

      <CardFooter>
        <Button
          className="w-full"
          onClick={() => selected && onPay?.(selected)}
          disabled={!selected || isLoading}
        >
          {isLoading ? "Processing..." : (amount !== undefined ? `Pay ${formatCurrency(amount)}` : "Pay")}
        </Button>
      </CardFooter>
    </Card>
  )
}
