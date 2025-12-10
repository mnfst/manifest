'use client'

import { Button } from '@/components/ui/button'
import { CreditCard, Lock } from 'lucide-react'
import { useState } from 'react'

export interface BankCardFormProps {
  onSubmit?: (data: { cardNumber: string; expiry: string; cvv: string }) => void
  submitLabel?: string
  amount?: number
  currency?: string
}

export function BankCardForm({
  onSubmit,
  submitLabel,
  amount = 279,
  currency = 'EUR'
}: BankCardFormProps) {
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
      currency
    }).format(value)
  }

  const handleSubmit = () => {
    onSubmit?.({ cardNumber, expiry, cvv })
  }

  const label = submitLabel || `Pay ${formatCurrency(amount)}`

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
