import { CurrencyPipe, NgIf } from '@angular/common'
import { Component, Input } from '@angular/core'
import { CurrencyOptions } from '~shared/interfaces/property-options/currency-options.interface'

@Component({
  selector: 'app-currency-yield',
  standalone: true,
  imports: [NgIf, CurrencyPipe],
  template: `<span class="is-nowrap" *ngIf="value">
      {{ value | currency : options.currency }}</span
    >
    <span class="is-nowrap" *ngIf="!value"> - </span>`,
  styleUrls: ['./currency-yield.component.scss']
})
export class CurrencyYieldComponent {
  @Input() value: number
  @Input() options: CurrencyOptions
}
