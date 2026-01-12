'use client'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { ChevronLeft, CreditCard, Info, Timer } from 'lucide-react'
import { useState, useEffect } from 'react'

// Format currency
function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2
  }).format(amount)
}

export interface OrderItem {
  name: string
  quantity: number
  price: number
}

export interface PaymentMethod {
  id: string
  name: string
  icon?: 'card' | 'paypal' | 'google' | 'apple'
}

const defaultPaymentMethods: PaymentMethod[] = [
  { id: 'card', name: 'Credit or debit card', icon: 'card' },
  { id: 'paypal', name: 'PayPal', icon: 'paypal' },
  { id: 'google', name: 'Google Pay', icon: 'google' }
]

const defaultOrderItems: OrderItem[] = [
  { name: 'General Admission', quantity: 1, price: 21.75 }
]

export interface EventCheckoutProps {
  data?: {
    eventTitle?: string
    eventDate?: string
    eventImage?: string
    eventPrice?: string
    orderItems?: OrderItem[]
    fees?: number
    delivery?: number
    deliveryMethod?: string
    paymentMethods?: PaymentMethod[]
    currency?: string
    timerMinutes?: number
  }
  actions?: {
    onBack?: () => void
    onPlaceOrder?: (formData: {
      firstName: string
      lastName: string
      email: string
      paymentMethod: string
      marketingOptIn: boolean
      eventUpdates: boolean
    }) => void
  }
  appearance?: {
    showTimer?: boolean
    showEventCard?: boolean
  }
}

export function EventCheckout({ data, actions, appearance }: EventCheckoutProps) {
  const {
    eventTitle = 'Player Play Date',
    eventDate = 'Fri, Feb 06 · 2:00 pm',
    eventImage,
    eventPrice = '$25.05',
    orderItems = defaultOrderItems,
    fees = 3.30,
    delivery = 0,
    deliveryMethod = '1 x eTicket',
    paymentMethods = defaultPaymentMethods,
    currency = 'USD',
    timerMinutes = 20
  } = data ?? {}
  const { onBack, onPlaceOrder } = actions ?? {}
  const { showTimer = true, showEventCard = true } = appearance ?? {}

  // Form state
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [confirmEmail, setConfirmEmail] = useState('')
  const [selectedPayment, setSelectedPayment] = useState(paymentMethods[0]?.id || 'card')
  const [marketingOptIn, setMarketingOptIn] = useState(true)
  const [eventUpdates, setEventUpdates] = useState(false)

  // Timer state
  const [timeLeft, setTimeLeft] = useState(timerMinutes * 60)

  useEffect(() => {
    if (!showTimer) return
    const interval = setInterval(() => {
      setTimeLeft(prev => Math.max(0, prev - 1))
    }, 1000)
    return () => clearInterval(interval)
  }, [showTimer])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Calculate totals
  const subtotal = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const total = subtotal + fees + delivery

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onPlaceOrder?.({
      firstName,
      lastName,
      email,
      paymentMethod: selectedPayment,
      marketingOptIn,
      eventUpdates
    })
  }

  const isFormValid = firstName && lastName && email && confirmEmail && email === confirmEmail

  const PaymentIcon = ({ type }: { type?: string }) => {
    switch (type) {
      case 'card':
        return <CreditCard className="h-5 w-5 text-muted-foreground" />
      case 'paypal':
        return (
          <div className="h-5 w-5 rounded bg-[#003087] flex items-center justify-center">
            <span className="text-white text-[10px] font-bold">P</span>
          </div>
        )
      case 'google':
        return (
          <div className="h-5 w-5 rounded border flex items-center justify-center">
            <span className="text-[10px] font-medium">G</span>
          </div>
        )
      case 'apple':
        return (
          <div className="h-5 w-5 rounded bg-black flex items-center justify-center">
            <span className="text-white text-[10px] font-bold">A</span>
          </div>
        )
      default:
        return <CreditCard className="h-5 w-5 text-muted-foreground" />
    }
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Left side - Checkout form */}
      <div className="flex-1">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
          <h2 className="text-xl font-semibold flex-1 text-center">Checkout</h2>
          {showTimer && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Timer className="h-4 w-4" />
              Time left {formatTime(timeLeft)}
            </div>
          )}
        </div>

        {/* Event card */}
        {showEventCard && (
          <div className="rounded-lg border p-4 mb-6">
            <div className="flex items-center gap-4">
              {eventImage && (
                <img
                  src={eventImage}
                  alt={eventTitle}
                  className="h-12 w-12 rounded object-cover"
                />
              )}
              <div>
                <h3 className="font-medium">{eventTitle}</h3>
                <p className="text-sm text-muted-foreground">{eventDate}</p>
                <p className="text-sm text-muted-foreground">{eventPrice}</p>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Billing information */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Billing information</h3>
              <span className="text-sm text-muted-foreground">
                <span className="text-destructive">*</span> Required
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <input
                  type="text"
                  placeholder="First name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full rounded-lg border bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>
              <div>
                <input
                  type="text"
                  placeholder="Last name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full rounded-lg border bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>
              <div>
                <input
                  type="email"
                  placeholder="Confirm email"
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                  className="w-full rounded-lg border bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>
            </div>

            {/* Marketing checkboxes */}
            <div className="space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox
                  checked={marketingOptIn}
                  onCheckedChange={(checked) => setMarketingOptIn(checked as boolean)}
                  className="mt-0.5"
                />
                <span className="text-sm">
                  Keep me updated on more events and news from this event organizer.
                </span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox
                  checked={eventUpdates}
                  onCheckedChange={(checked) => setEventUpdates(checked as boolean)}
                  className="mt-0.5"
                />
                <span className="text-sm">
                  Send me emails about the best events happening nearby or online.
                </span>
              </label>
            </div>
          </div>

          {/* Payment methods */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-4">Pay with</h3>
            <div className="space-y-3">
              {paymentMethods.map((method) => (
                <label
                  key={method.id}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border p-4 cursor-pointer transition-colors',
                    selectedPayment === method.id && 'border-primary ring-1 ring-primary'
                  )}
                >
                  <input
                    type="radio"
                    name="payment"
                    value={method.id}
                    checked={selectedPayment === method.id}
                    onChange={() => setSelectedPayment(method.id)}
                    className="sr-only"
                  />
                  <PaymentIcon type={method.icon} />
                  <span className="font-medium">{method.name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Terms and submit */}
          <div>
            <p className="text-sm text-muted-foreground mb-4">
              By selecting Place Order, I agree to the{' '}
              <a href="#" className="text-primary hover:underline">
                Terms of Service
              </a>
            </p>
            <Button
              type="submit"
              className="w-full sm:w-auto"
              size="lg"
              disabled={!isFormValid}
            >
              Place Order
            </Button>
          </div>
        </form>
      </div>

      {/* Right side - Order summary */}
      <div className="w-full lg:w-80 shrink-0">
        <div className="rounded-lg border bg-card p-4">
          <h3 className="font-semibold mb-4">Order summary</h3>

          {/* Line items */}
          <div className="space-y-2">
            {orderItems.map((item, index) => (
              <div key={index} className="flex justify-between text-sm">
                <span>{item.quantity} x {item.name}</span>
                <span>{formatCurrency(item.price * item.quantity, currency)}</span>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="mt-4 pt-4 border-t space-y-2">
            <div className="flex justify-between text-sm">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal, currency)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="flex items-center gap-1">
                Fees
                <Info className="h-3 w-3 text-muted-foreground" />
              </span>
              <span>{formatCurrency(fees, currency)}</span>
            </div>
            {delivery !== undefined && (
              <div className="flex justify-between text-sm">
                <div>
                  <span>Delivery</span>
                  {deliveryMethod && (
                    <p className="text-xs text-muted-foreground">{deliveryMethod}</p>
                  )}
                </div>
                <span>{formatCurrency(delivery, currency)}</span>
              </div>
            )}
          </div>

          <div className="mt-4 pt-4 border-t">
            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <span>{formatCurrency(total, currency)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
