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

/*
 * PayConfirm Component - ChatGPT UI Guidelines Compliant
 * - Limit to 2 primary actions (Cancel + Confirm)
 * - Use system colors for icons (no custom green)
 * - Proper visual hierarchy: headline, details, CTA
 * - No nested scrolling
 */

export interface PayConfirmProps {
  data?: {
    amount: number
    cardLast4?: string
    cardBrand?: string
  }
  actions?: {
    onConfirm?: () => void
    onCancel?: () => void
  }
  appearance?: {
    currency?: string
  }
  control?: {
    isLoading?: boolean
  }
}

export function PayConfirm({ data, actions, appearance, control }: PayConfirmProps) {
  const { amount = 0, cardLast4 = "4242", cardBrand = "Visa" } = data ?? {}
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
