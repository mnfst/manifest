'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CreditCard, Lock, Plus } from 'lucide-react'
import { useState } from 'react'

/**
 * Represents a payment method option.
 * @interface PaymentMethod
 * @property {string} id - Unique identifier for the payment method
 * @property {"card" | "apple_pay" | "google_pay" | "paypal"} type - Type of payment method
 * @property {"visa" | "mastercard" | "amex" | "cb"} [brand] - Card brand (for card type)
 * @property {string} [last4] - Last 4 digits of card (for card type)
 * @property {boolean} [isDefault] - Whether this is the default payment method
 */
export interface PaymentMethod {
  id: string
  type: 'card' | 'apple_pay' | 'google_pay' | 'paypal'
  brand?: 'visa' | 'mastercard' | 'amex' | 'cb'
  last4?: string
  isDefault?: boolean
}

/**
 * Props for the PaymentMethods component.
 * @interface PaymentMethodsProps
 * @property {object} [data] - Payment methods and amount data
 * @property {PaymentMethod[]} [data.methods] - Available payment methods
 * @property {number} [data.amount] - Amount to charge
 * @property {object} [actions] - Callback functions for user actions
 * @property {function} [actions.onSelectMethod] - Called when a method is selected
 * @property {function} [actions.onAddCard] - Called when user wants to add a card
 * @property {function} [actions.onPay] - Called when user initiates payment
 * @property {object} [appearance] - Visual customization options
 * @property {string} [appearance.currency] - Currency code for formatting
 * @property {object} [control] - State control options
 * @property {string} [control.selectedMethodId] - Currently selected method ID
 * @property {boolean} [control.isLoading] - Shows loading state on pay button
 */
export interface PaymentMethodsProps {
  /** Content and data to display */
  data?: {
    methods?: PaymentMethod[]
    amount?: number
  }
  /** User-triggerable callbacks */
  actions?: {
    onSelectMethod?: (methodId: string) => void
    onAddCard?: () => void
    onPay?: (methodId: string) => void
  }
  /** Visual configuration options */
  appearance?: {
    currency?: string
  }
  /** State management */
  control?: {
    selectedMethodId?: string
    isLoading?: boolean
  }
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
      <div className="h-5 w-8 rounded bg-black flex items-center justify-center">
        <img src="/images/apple-pay.svg" alt="Apple Pay" className="h-2 w-auto invert" />
      </div>
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

/**
 * A payment method selector supporting cards (Visa, Mastercard, CB, Amex) and digital wallets.
 * Displays methods as pill-shaped buttons with brand logos.
 *
 * Features:
 * - Card brand logos (Visa, Mastercard, Amex, CB)
 * - Digital wallet support (Apple Pay, Google Pay, PayPal)
 * - Pill-shaped method selectors
 * - Default method indicator
 * - Add new card option
 * - Secure transaction indicator
 * - Loading state support
 *
 * @component
 * @example
 * ```tsx
 * <PaymentMethods
 *   data={{
 *     methods: [
 *       { id: "1", type: "card", brand: "visa", last4: "4242" },
 *       { id: "2", type: "apple_pay" }
 *     ],
 *     amount: 99.99
 *   }}
 *   actions={{
 *     onSelectMethod: (id) => console.log("Selected:", id),
 *     onAddCard: () => console.log("Add card"),
 *     onPay: (id) => console.log("Pay with:", id)
 *   }}
 *   appearance={{ currency: "USD" }}
 * />
 * ```
 */
export function PaymentMethods({ data, actions, appearance, control }: PaymentMethodsProps) {
  const { methods = defaultMethods, amount = 279.0 } = data ?? {}
  const { onSelectMethod, onAddCard, onPay } = actions ?? {}
  const { currency = 'EUR' } = appearance ?? {}
  const { selectedMethodId, isLoading = false } = control ?? {}
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
              'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors cursor-pointer',
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
          className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
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
