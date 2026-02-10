'use client'

import { Button } from '@/components/ui/button'
import { CreditCard, Lock } from 'lucide-react'
import { useState } from 'react'

/**
 * Data structure representing bank card form submission.
 * @interface BankCardFormData
 * @property {string} cardNumber - The formatted card number
 * @property {string} expiry - Expiry date in MM/YY format
 * @property {string} cvv - Card verification value (3 digits)
 */
export interface BankCardFormData {
  cardNumber?: string
  expiry?: string
  cvv?: string
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * BankCardFormProps
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Props for a compact bank card payment form with inline layout optimized
 * for chat interfaces. All inputs appear in a single row on desktop.
 */
export interface BankCardFormProps {
  data?: {
    /**
     * Amount to charge, displayed in the submit button.
     * @default 279
     */
    amount?: number
  }
  actions?: {
    /** Called when the form is submitted with card number, expiry, and CVV. */
    onSubmit?: (data: BankCardFormData) => void
  }
  appearance?: {
    /** Custom label for the submit button. Overrides the default "Pay {amount}" label. */
    submitLabel?: string
    /**
     * Currency code for formatting the amount.
     * @default "EUR"
     */
    currency?: string
  }
}

/**
 * A compact bank card payment form with inline layout optimized for chat interfaces.
 * All inputs appear in a single row on desktop for minimal footprint.
 *
 * Features:
 * - Compact inline layout on desktop
 * - Card number with automatic formatting
 * - MM/YY expiry formatting
 * - CVV input
 * - Customizable submit button label
 * - Lock icon for security indication
 *
 * @component
 * @example
 * ```tsx
 * <BankCardForm
 *   data={{ amount: 99.99 }}
 *   actions={{
 *     onSubmit: (data) => console.log("Card submitted:", data)
 *   }}
 *   appearance={{
 *     submitLabel: "Pay Now",
 *     currency: "USD"
 *   }}
 * />
 * ```
 */
export function BankCardForm({ data, actions, appearance }: BankCardFormProps) {
  const amount = data?.amount
  const onSubmit = actions?.onSubmit
  const submitLabel = appearance?.submitLabel
  const currency = appearance?.currency
  const [cardNumber, setCardNumber] = useState('')
  const [expiry, setExpiry] = useState('')
  const [cvv, setCvv] = useState('')

  const formatCardNumber = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 16)
    return digits.replace(/(\d{4})(?=\d)/g, '$1 ')
  }

  const formatExpiry = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 4)
    if (digits.length >= 2) {
      return digits.slice(0, 2) + '/' + digits.slice(2)
    }
    return digits
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD'
    }).format(value)
  }

  const handleSubmit = () => {
    onSubmit?.({ cardNumber, expiry, cvv })
  }

  const label = submitLabel ? submitLabel : (amount !== undefined ? `Pay ${formatCurrency(amount)}` : 'Pay')

  return (
    <div className="w-full rounded-md sm:rounded-lg bg-card p-3 space-y-3 sm:space-y-0 sm:p-0 sm:pl-4 sm:pr-2 sm:py-2 sm:flex sm:items-center sm:gap-2">
      {/* Card number row */}
      <div className="flex items-center gap-2 sm:flex-1 sm:min-w-0">
        <CreditCard className="h-4 w-4 text-muted-foreground shrink-0" />
        <input
          type="text"
          placeholder="Card number"
          value={cardNumber}
          onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
          className="h-8 bg-transparent border-0 outline-none text-sm flex-1 min-w-0 placeholder:text-muted-foreground"
        />
      </div>
      {/* Expiry and CVV row */}
      <div className="flex items-center gap-2">
        <div className="hidden sm:block h-4 w-px bg-border shrink-0" />
        <input
          type="text"
          placeholder="MM/YY"
          value={expiry}
          onChange={(e) => setExpiry(formatExpiry(e.target.value))}
          className="h-8 bg-transparent border-0 outline-none text-sm w-14 sm:text-center placeholder:text-muted-foreground"
        />
        <div className="h-4 w-px bg-border shrink-0" />
        <input
          type="text"
          placeholder="CVV"
          value={cvv}
          onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, 3))}
          className="h-8 bg-transparent border-0 outline-none text-sm w-10 sm:text-center placeholder:text-muted-foreground"
        />
      </div>
      <Button size="sm" onClick={handleSubmit} className="w-full sm:w-auto shrink-0 sm:ml-1">
        <Lock className="h-3 w-3 mr-1.5" />
        {label}
      </Button>
    </div>
  )
}
