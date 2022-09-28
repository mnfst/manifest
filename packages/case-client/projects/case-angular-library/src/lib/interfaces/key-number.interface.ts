import { Subscription } from 'rxjs'

export interface KeyNumber {
  label: string
  extraParams: { [key: string]: string }
  permission?: string
  className?: string

  // Calculated.
  subscription?: Subscription
  loading?: boolean
  value?: number
}
