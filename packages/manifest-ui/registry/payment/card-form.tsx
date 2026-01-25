'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CreditCard, Lock } from 'lucide-react'

/**
 * Data structure representing credit card form submission.
 * @interface CardFormData
 * @property {string} cardNumber - The formatted card number (with spaces)
 * @property {string} cardHolder - The cardholder's name
 * @property {string} expiryDate - Expiry date in MM/YY format
 * @property {string} cvv - Card verification value (3-4 digits)
 */
export interface CardFormData {
  cardNumber?: string
  cardHolder?: string
  expiryDate?: string
  cvv?: string
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CardFormProps
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Props for a credit card payment form with card number, expiry date, CVV,
 * and cardholder name fields. Includes automatic formatting for inputs.
 */
export interface CardFormProps {
  actions?: {
    /** Called when the form is submitted with complete card data. */
    onSubmit?: (data: CardFormData) => void
  }
  control?: {
    /**
     * Shows loading state on the submit button.
     * @default false
     */
    isLoading?: boolean
  }
}

/**
 * A credit card payment form with card number, expiry date, CVV, and cardholder name fields.
 * Includes automatic formatting for card number and expiry date inputs.
 *
 * Features:
 * - Card number formatting with spaces every 4 digits
 * - Automatic MM/YY expiry date formatting
 * - CVV input with masking
 * - Loading state support
 * - Secure payment button with lock icon
 *
 * @component
 * @example
 * ```tsx
 * <CardForm
 *   actions={{
 *     onSubmit: (data) => console.log("Payment data:", data)
 *   }}
 *   control={{ isLoading: false }}
 * />
 * ```
 */
export function CardForm({ actions, control }: CardFormProps) {
  const { onSubmit } = actions ?? {}
  const { isLoading = false } = control ?? {}
  const [formData, setFormData] = useState<CardFormData>({
    cardNumber: '',
    cardHolder: '',
    expiryDate: '',
    cvv: ''
  })

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '')
    const matches = v.match(/\d{4,16}/g)
    const match = (matches && matches[0]) || ''
    const parts = []

    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4))
    }

    if (parts.length) {
      return parts.join(' ')
    } else {
      return value
    }
  }

  const formatExpiryDate = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '')
    if (v.length >= 2) {
      return v.substring(0, 2) + '/' + v.substring(2, 4)
    }
    return v
  }

  const handleChange = (field: keyof CardFormData, value: string) => {
    let formattedValue = value

    if (field === 'cardNumber') {
      formattedValue = formatCardNumber(value)
    } else if (field === 'expiryDate') {
      formattedValue = formatExpiryDate(value.replace('/', ''))
    } else if (field === 'cvv') {
      formattedValue = value.replace(/[^0-9]/g, '').substring(0, 4)
    }

    setFormData((prev) => ({ ...prev, [field]: formattedValue }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit?.(formData)
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Payment Details
        </CardTitle>
        <CardDescription>
          Enter your card information to complete the payment
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cardNumber">Card Number</Label>
            <Input
              id="cardNumber"
              placeholder="1234 5678 9012 3456"
              value={formData.cardNumber}
              onChange={(e) => handleChange('cardNumber', e.target.value)}
              maxLength={19}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cardHolder">Cardholder Name</Label>
            <Input
              id="cardHolder"
              placeholder="John Doe"
              value={formData.cardHolder}
              onChange={(e) => handleChange('cardHolder', e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="expiryDate">Expiry Date</Label>
              <Input
                id="expiryDate"
                placeholder="MM/YY"
                value={formData.expiryDate}
                onChange={(e) => handleChange('expiryDate', e.target.value)}
                maxLength={5}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cvv">CVV</Label>
              <Input
                id="cvv"
                placeholder="123"
                type="password"
                value={formData.cvv}
                onChange={(e) => handleChange('cvv', e.target.value)}
                maxLength={4}
              />
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              'Processing...'
            ) : (
              <>
                <Lock className="mr-2 h-4 w-4" />
                Pay Securely
              </>
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
