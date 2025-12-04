'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CreditCard, Lock, Plus } from 'lucide-react'
import { useState } from 'react'

export interface PaymentMethod {
  id: string
  type: 'card' | 'apple_pay' | 'google_pay' | 'paypal'
  brand?: 'visa' | 'mastercard' | 'amex' | 'cb'
  last4?: string
  isDefault?: boolean
}

export interface InlinePaymentMethodsProps {
  methods?: PaymentMethod[]
  amount?: number
  currency?: string
  selectedMethodId?: string
  onSelectMethod?: (methodId: string) => void
  onAddCard?: () => void
  onPay?: (methodId: string) => void
  isLoading?: boolean
}

const defaultMethods: PaymentMethod[] = [
  { id: '1', type: 'card', brand: 'visa', last4: '4242' },
  {
    id: '2',
    type: 'card',
    brand: 'mastercard',
    last4: '8888',
    isDefault: true
  },
  { id: '3', type: 'apple_pay' }
]

const BrandLogo = ({ brand }: { brand?: string }) => {
  switch (brand) {
    case 'visa':
      return (
        <svg viewBox="0 0 48 32" className="h-5 w-auto">
          <rect width="48" height="32" rx="4" fill="#1A1F71" />
          <path
            d="M19.5 21h-3l1.9-11.5h3L19.5 21zm-5.2 0h-3.1l-2.8-9.2-.3 1.5L7 20.9H3.9l4.5-11.4h3.2l2.7 11.5zm16.5-7.5c0-.8.7-1.3 1.8-1.3.8 0 1.5.2 2 .5l.4-2.2c-.6-.2-1.4-.4-2.4-.4-2.5 0-4.3 1.3-4.3 3.2 0 1.4 1.3 2.2 2.3 2.6 1 .5 1.4.8 1.4 1.2 0 .7-.8 1-1.6 1-.9 0-1.8-.2-2.6-.6l-.4 2.3c.7.3 1.7.5 2.9.5 2.7 0 4.4-1.3 4.4-3.3 0-2.5-3.9-2.7-3.9-3.5zm12.1 7.5h-2.8l-.2-1.2h-3.5l-.6 1.2h-3.1l4.4-10.6c.2-.5.7-.9 1.4-.9h2.5L42.9 21zm-3.5-3.5l-1.4-4-1.4 4h2.8z"
            fill="white"
          />
        </svg>
      )
    case 'mastercard':
      return (
        <svg viewBox="0 0 48 32" className="h-5 w-auto">
          <rect width="48" height="32" rx="4" fill="#000" />
          <circle cx="18" cy="16" r="8" fill="#EB001B" />
          <circle cx="30" cy="16" r="8" fill="#F79E1B" />
          <path
            d="M24 10.3a8 8 0 0 0-2.8 5.7 8 8 0 0 0 2.8 5.7 8 8 0 0 0 2.8-5.7 8 8 0 0 0-2.8-5.7z"
            fill="#FF5F00"
          />
        </svg>
      )
    case 'amex':
      return (
        <svg viewBox="0 0 48 32" className="h-5 w-auto">
          <rect width="48" height="32" rx="4" fill="#006FCF" />
          <path
            d="M10 12h4l.8 2 .8-2h4v8h-3v-5l-1.3 3h-2l-1.3-3v5h-2v-8zm14 0h6v2h-3v1h3v2h-3v1h3v2h-6v-8zm8 0h3l2 3 2-3h3l-3.5 4 3.5 4h-3l-2-3-2 3h-3l3.5-4-3.5-4z"
            fill="white"
          />
        </svg>
      )
    case 'cb':
      return (
        <svg viewBox="0 0 48 32" className="h-5 w-auto">
          <rect width="48" height="32" rx="4" fill="#1E4B9E" />
          <rect x="4" y="10" width="18" height="12" rx="2" fill="#49A942" />
          <text x="28" y="20" fill="white" fontSize="10" fontWeight="bold">
            CB
          </text>
        </svg>
      )
    default:
      return <CreditCard className="h-5 w-5 text-muted-foreground" />
  }
}

const MethodIcon = ({ method }: { method: PaymentMethod }) => {
  if (method.type === 'apple_pay') {
    return (
      <svg viewBox="0 0 48 32" className="h-5 w-auto">
        <rect width="48" height="32" rx="4" fill="#000" />
        <path
          d="M15.2 11.3c-.6.7-1.5 1.2-2.4 1.1-.1-.9.3-1.9.9-2.5.6-.7 1.6-1.2 2.4-1.2.1 1-.3 1.9-.9 2.6zm.9 1.3c-1.3-.1-2.5.8-3.1.8-.6 0-1.6-.7-2.7-.7-1.4 0-2.7.8-3.4 2.1-1.4 2.5-.4 6.2 1 8.3.7 1 1.5 2.1 2.6 2.1 1 0 1.4-.7 2.7-.7 1.2 0 1.6.7 2.7.7 1.1 0 1.8-1 2.5-2 .8-1.1 1.1-2.2 1.1-2.3 0 0-2.2-.8-2.2-3.3 0-2.1 1.7-3.1 1.8-3.2-.9-1.5-2.4-1.7-3-1.8zm9.9.6h3.2c2.2 0 3.7 1.5 3.7 3.8 0 2.3-1.6 3.8-3.8 3.8h-2.1v3.9H25v-11.5zm1.3 6.3h1.7c1.5 0 2.4-.8 2.4-2.2 0-1.4-.9-2.2-2.4-2.2h-1.7v4.4zm11.3 5.4c-1.3 0-2.5-.7-2.7-1.8h-.1v1.7h-1.2V13.3h1.3v4.4h.1c.3-1.1 1.4-1.8 2.6-1.8 2 0 3.3 1.6 3.3 4.1 0 2.5-1.3 4-3.3 4zm-.3-6.8c-1.4 0-2.3 1.2-2.3 2.8 0 1.6.9 2.8 2.3 2.8 1.4 0 2.3-1.2 2.3-2.8 0-1.6-.9-2.8-2.3-2.8z"
          fill="white"
        />
      </svg>
    )
  }
  if (method.type === 'google_pay') {
    return (
      <svg viewBox="0 0 48 32" className="h-5 w-auto">
        <rect width="48" height="32" rx="4" fill="#fff" stroke="#ddd" />
        <text x="8" y="20" fontSize="10" fontWeight="500" fill="#5F6368">
          G Pay
        </text>
      </svg>
    )
  }
  if (method.type === 'paypal') {
    return (
      <svg viewBox="0 0 48 32" className="h-5 w-auto">
        <rect width="48" height="32" rx="4" fill="#003087" />
        <text x="8" y="20" fontSize="9" fontWeight="bold" fill="#fff">
          PayPal
        </text>
      </svg>
    )
  }
  return <BrandLogo brand={method.brand} />
}

export function InlinePaymentMethods({
  methods = defaultMethods,
  amount = 279.0,
  currency = 'EUR',
  selectedMethodId,
  onSelectMethod,
  onAddCard,
  onPay,
  isLoading = false
}: InlinePaymentMethodsProps) {
  const [selected, setSelected] = useState(
    selectedMethodId || methods.find((m) => m.isDefault)?.id || methods[0]?.id
  )

  const handleSelect = (methodId: string) => {
    setSelected(methodId)
    onSelectMethod?.(methodId)
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency
    }).format(value)
  }

  const getMethodLabel = (method: PaymentMethod) => {
    if (method.type === 'apple_pay') return 'Apple Pay'
    if (method.type === 'google_pay') return 'Google Pay'
    if (method.type === 'paypal') return 'PayPal'
    return `•••• ${method.last4}`
  }

  return (
    <div className="w-full rounded-lg bg-card p-2 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {methods.map((method) => (
          <button
            key={method.id}
            onClick={() => handleSelect(method.id)}
            className={cn(
              'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors',
              selected === method.id
                ? 'border-foreground ring-1 ring-foreground'
                : 'border-border  hover:border-foreground/50'
            )}
          >
            <MethodIcon method={method} />
            <span>{getMethodLabel(method)}</span>
            {method.isDefault && (
              <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                Default
              </span>
            )}
          </button>
        ))}
        <button
          onClick={onAddCard}
          className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Plus className="h-4 w-4" />
          Add
        </button>
      </div>

      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="h-3 w-3" />
          Secure encrypted transaction
        </span>
        <Button
          size="sm"
          onClick={() => selected && onPay?.(selected)}
          disabled={!selected || isLoading}
        >
          <Lock className="mr-1.5 h-3.5 w-3.5" />
          {isLoading ? 'Processing...' : `Pay ${formatCurrency(amount)}`}
        </Button>
      </div>
    </div>
  )
}
