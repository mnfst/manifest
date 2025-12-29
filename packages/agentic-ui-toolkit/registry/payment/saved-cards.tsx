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

export interface SavedCard {
  id: string
  brand: "visa" | "mastercard" | "amex"
  last4: string
  expiryMonth: string
  expiryYear: string
  isDefault?: boolean
}

export interface SavedCardsProps {
  data?: {
    cards?: SavedCard[]
    amount?: number
  }
  actions?: {
    onSelectCard?: (cardId: string) => void
    onAddNewCard?: () => void
    onPay?: (cardId: string) => void
  }
  appearance?: {
    currency?: string
  }
  control?: {
    selectedCardId?: string
    isLoading?: boolean
  }
}

const defaultCards: SavedCard[] = [
  {
    id: "1",
    brand: "visa",
    last4: "4242",
    expiryMonth: "12",
    expiryYear: "26",
    isDefault: true,
  },
  {
    id: "2",
    brand: "mastercard",
    last4: "8888",
    expiryMonth: "03",
    expiryYear: "25",
  },
]

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

export function SavedCards({ data, actions, appearance, control }: SavedCardsProps) {
  const { cards = defaultCards, amount = 279.0 } = data ?? {}
  const { onSelectCard, onAddNewCard, onPay } = actions ?? {}
  const { currency = "EUR" } = appearance ?? {}
  const { selectedCardId, isLoading = false } = control ?? {}
  const [selected, setSelected] = useState(
    selectedCardId || cards.find((c) => c.isDefault)?.id || cards[0]?.id
  )

  const handleSelect = (cardId: string) => {
    setSelected(cardId)
    onSelectCard?.(cardId)
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
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
        {cards.map((card) => (
          <button
            key={card.id}
            onClick={() => handleSelect(card.id)}
            className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all ${
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
              <p className="text-sm font-medium">
                •••• •••• •••• {card.last4}
              </p>
              <p className="text-xs text-muted-foreground">
                Expires {card.expiryMonth}/{card.expiryYear}
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
          className="w-full flex items-center gap-3 p-3 rounded-lg border border-dashed border-border hover:border-primary/50 hover:bg-muted/50 transition-all"
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
          {isLoading ? "Processing..." : `Pay ${formatCurrency(amount)}`}
        </Button>
      </CardFooter>
    </Card>
  )
}
