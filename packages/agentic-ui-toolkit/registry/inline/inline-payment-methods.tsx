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
          <rect width="48" height="32" rx="4" fill="#fff" stroke="#e5e5e5" />
          <g transform="translate(5, 10) scale(0.15)">
            <polygon points="116.145,95.719 97.858,95.719 109.296,24.995 127.582,24.995" fill="#00579f" />
            <path d="M182.437,26.724c-3.607-1.431-9.328-3.011-16.402-3.011c-18.059,0-30.776,9.63-30.854,23.398c-0.15,10.158,9.105,15.8,16.027,19.187c7.075,3.461,9.48,5.72,9.48,8.805c-0.072,4.738-5.717,6.922-10.982,6.922c-7.301,0-11.213-1.126-17.158-3.762l-2.408-1.13l-2.559,15.876c4.289,1.954,12.191,3.688,20.395,3.764c19.188,0,31.68-9.481,31.828-24.153c0.073-8.051-4.814-14.22-15.35-19.261c-6.396-3.236-10.313-5.418-10.313-8.729c0.075-3.01,3.313-6.093,10.533-6.093c5.945-0.151,10.313,1.278,13.622,2.708l1.654,0.751l2.487-15.272z" fill="#00579f" />
            <path d="M206.742,70.664c1.506-4.063,7.301-19.788,7.301-19.788c-0.076,0.151,1.503-4.138,2.406-6.771l1.278,6.094c0,0,3.463,16.929,4.215,20.465c-2.858,0-11.588,0-15.2,0zm22.573-45.669l-14.145,0c-4.362,0-7.676,1.278-9.558,5.868l-27.163,64.855l19.188,0c0,0,3.159-8.729,3.838-10.609c2.105,0,20.771,0,23.479,0c0.525,2.483,2.182,10.609,2.182,10.609l16.932,0l-14.753-70.723z" fill="#00579f" />
            <path d="M82.584,24.995l-17.909,48.227l-1.957-9.781c-3.311-11.286-13.695-23.548-25.283-29.645l16.404,61.848l19.338,0l28.744-70.649l-19.337,0z" fill="#00579f" />
            <path d="M48.045,24.995l-29.422,0l-0.301,1.429c22.951,5.869,38.151,20.016,44.396,37.02l-6.396-32.523c-1.053-4.517-4.289-5.796-8.277-5.926z" fill="#faa61a" />
          </g>
        </svg>
      )
    case 'mastercard':
      return (
        <svg viewBox="0 0 48 32" className="h-5 w-auto">
          <rect width="48" height="32" rx="4" fill="#fff" stroke="#e5e5e5" />
          <g transform="translate(7, 5) scale(0.22)">
            <rect x="60.4" y="25.7" width="31.5" height="56.6" fill="#FF5F00" />
            <path d="M62.4,54c0-11,5.1-21.5,13.7-28.3c-15.6-12.3-38.3-9.6-50.6,6.1C13.3,47.4,16,70,31.7,82.3c13.1,10.3,31.4,10.3,44.5,0C67.5,75.5,62.4,65,62.4,54z" fill="#EB001B" />
            <path d="M134.4,54c0,19.9-16.1,36-36,36c-8.1,0-15.9-2.7-22.2-7.7c15.6-12.3,18.3-34.9,6-50.6c-1.8-2.2-3.8-4.3-6-6c15.6-12.3,38.3-9.6,50.5,6.1C131.7,38.1,134.4,45.9,134.4,54z" fill="#F79E1B" />
          </g>
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
        <g transform="translate(4, 6) scale(0.078)">
          <path d="M93.6,27.1C87.6,34.2,78,39.8,68.4,39c-1.2-9.6,3.5-19.8,9-26.1c6-7.3,16.5-12.5,25-12.9C103.4,10,99.5,19.8,93.6,27.1 M102.3,40.9c-13.9-0.8-25.8,7.9-32.4,7.9c-6.7,0-16.8-7.5-27.8-7.3c-14.3,0.2-27.6,8.3-34.9,21.2c-15,25.8-3.9,64,10.6,85c7.1,10.4,15.6,21.8,26.8,21.4c10.6-0.4,14.8-6.9,27.6-6.9c12.9,0,16.6,6.9,27.8,6.7c11.6-0.2,18.9-10.4,26-20.8c8.1-11.8,11.4-23.3,11.6-23.9c-0.2-0.2-22.4-8.7-22.6-34.3c-0.2-21.4,17.5-31.6,18.3-32.2C123.3,42.9,107.7,41.3,102.3,40.9 M182.6,11.9v155.9h24.2v-53.3h33.5c30.6,0,52.1-21,52.1-51.4c0-30.4-21.1-51.2-51.3-51.2H182.6z M206.8,32.3h27.9c21,0,33,11.2,33,30.9c0,19.7-12,31-33.1,31h-27.8V32.3z M336.6,169c15.2,0,29.3-7.7,35.7-19.9h0.5v18.7h22.4V90.2c0-22.5-18-37-45.7-37c-25.7,0-44.7,14.7-45.4,34.9h21.8c1.8-9.6,10.7-15.9,22.9-15.9c14.8,0,23.1,6.9,23.1,19.6v8.6l-30.2,1.8c-28.1,1.7-43.3,13.2-43.3,33.2C298.4,155.6,314.1,169,336.6,169z M343.1,150.5c-12.9,0-21.1-6.2-21.1-15.7c0-9.8,7.9-15.5,23-16.4l26.9-1.7v8.8C371.9,140.1,359.5,150.5,343.1,150.5z M425.1,210.2c23.6,0,34.7-9,44.4-36.3L512,54.7h-24.6l-28.5,92.1h-0.5l-28.5-92.1h-25.3l41,113.5l-2.2,6.9c-3.7,11.7-9.7,16.2-20.4,16.2c-1.9,0-5.6-0.2-7.1-0.4v18.7C417.3,210,423.3,210.2,425.1,210.2z" fill="white" />
        </g>
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
    <div className="w-full rounded-md sm:rounded-lg bg-card p-2 space-y-4">
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

      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2">
        <span className="flex items-center justify-center sm:justify-start gap-1.5 text-xs text-muted-foreground">
          <Lock className="h-3 w-3" />
          Secure encrypted transaction
        </span>
        <Button
          size="sm"
          className="w-full sm:w-auto"
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
