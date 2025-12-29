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
import { CheckCircle2, CreditCard, ShieldCheck } from "lucide-react"

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
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <ShieldCheck className="h-6 w-6 text-primary" />
        </div>
        <CardTitle>Confirm Payment</CardTitle>
        <CardDescription>
          Please review and confirm your payment details
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg bg-muted/50 p-4 text-center">
          <p className="text-sm text-muted-foreground">Amount to pay</p>
          <p className="text-3xl font-bold">{formatCurrency(amount)}</p>
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
              <CreditCard className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">{cardBrand}</p>
              <p className="text-sm text-muted-foreground">
                •••• •••• •••• {cardLast4}
              </p>
            </div>
          </div>
          <CheckCircle2 className="h-5 w-5 text-green-500" />
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
          {isLoading ? "Processing..." : "Confirm Payment"}
        </Button>
      </CardFooter>
    </Card>
  )
}
