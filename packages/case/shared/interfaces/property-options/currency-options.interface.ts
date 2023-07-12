import { PropertyOptions } from './property-options.interface'
export interface CurrencyOptions extends PropertyOptions {
  /* ISO 4217 currency code like "EUR", "USD", "JPY", "CNY", "MXN", "DZD" */
  currency: string
}
