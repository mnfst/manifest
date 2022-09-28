import { Pipe, PipeTransform } from '@angular/core'
import { formatCurrency, getCurrencySymbol } from '@angular/common'

@Pipe({
  name: 'euros'
})
export class EurosPipe implements PipeTransform {
  transform(value: number): string | null {
    // Prevent showing infinity signs.
    if (isNaN(value) || value === null || value === undefined) {
      return '-'
    }
    // Format currency in Euros without 2 digits after coma if not needed.
    return formatCurrency(
      value,
      'fr',
      getCurrencySymbol('EUR', 'wide'),
      'EUR',
      // Prevent showing numbers after coma if number is integer and force 2 digits if not.
      Number.isInteger(value) ? '1.0-2' : '1.2-2'
    )
  }
}
