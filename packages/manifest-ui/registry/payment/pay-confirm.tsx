"use client"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Check, CreditCard, ShieldCheck } from "lucide-react"

/**
 * Props for the PayConfirm component.
 * @interface PayConfirmProps
 * @property {object} [data] - Payment data to display
 * @property {number} data.amount - The amount to be charged
 * @property {string} [data.cardLast4] - Last 4 digits of the card
 * @property {string} [data.cardBrand] - Card brand name (e.g., 'Visa', 'Mastercard')
 * @property {object} [actions] - Callback functions for user actions
 * @property {function} [actions.onConfirm] - Called when user confirms the payment
 * @property {function} [actions.onCancel] - Called when user cancels the payment
 * @property {object} [appearance] - Visual customization options
 * @property {string} [appearance.currency] - Currency code for formatting (default: 'USD')
 * @property {object} [control] - State control options
 * @property {boolean} [control.isLoading] - Shows loading state on buttons
 */
export interface PayConfirmProps {
  /** Content and data to display */
  data?: {
    amount: number
    cardLast4?: string
    cardBrand?: string
  }
  /** User-triggerable callbacks */
  actions?: {
    onConfirm?: () => void
    onCancel?: () => void
  }
  /** Visual configuration options */
  appearance?: {
    currency?: string
  }
  /** State management */
  control?: {
    isLoading?: boolean
  }
}

/**
 * A payment confirmation component displaying amount, card details, and confirm/cancel actions.
 * Follows ChatGPT UI guidelines for clear visual hierarchy and limited primary actions.
 *
 * Features:
 * - Large amount display in highlighted box
 * - Card brand and last 4 digits preview
 * - Confirm and cancel action buttons
 * - Loading state support
 * - Shield icon for security indication
 *
 * @component
 * @example
 * ```tsx
 * <PayConfirm
 *   data={{
 *     amount: 99.99,
 *     cardLast4: "4242",
 *     cardBrand: "Visa"
 *   }}
 *   actions={{
 *     onConfirm: () => console.log("Payment confirmed"),
 *     onCancel: () => console.log("Payment cancelled")
 *   }}
 *   appearance={{ currency: "USD" }}
 *   control={{ isLoading: false }}
 * />
 * ```
 */
export function PayConfirm({ data, actions, appearance, control }: PayConfirmProps) {
  const { amount = 99.99, cardLast4 = "4242", cardBrand = "Visa" } = data ?? {}
  const { onConfirm, onCancel } = actions ?? {}
  const { currency = "USD" } = appearance ?? {}
  const { isLoading = false } = control ?? {}
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(value)
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
          <ShieldCheck className="h-5 w-5 text-foreground" />
        </div>
        <CardTitle>Confirm Payment</CardTitle>
        <CardDescription>
          Review and confirm your payment details
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg bg-muted p-4 text-center">
          <p className="text-sm text-muted-foreground">Amount to pay</p>
          <p className="text-2xl font-semibold">{formatCurrency(amount)}</p>
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">{cardBrand}</p>
              <p className="text-sm text-muted-foreground">
                •••• {cardLast4}
              </p>
            </div>
          </div>
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-foreground">
            <Check className="h-3 w-3 text-background" />
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex gap-3">
        <Button
          variant="outline"
          className="flex-1"
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button className="flex-1" onClick={onConfirm} disabled={isLoading}>
          {isLoading ? "Processing..." : "Confirm"}
        </Button>
      </CardFooter>
    </Card>
  )
}
