import { CurrencyPipe, NgIf } from '@angular/common'
import { Component, Input } from '@angular/core'

@Component({
  selector: 'app-currency-yield',
  standalone: true,
  imports: [NgIf, CurrencyPipe],
  template: `<span class="is-nowrap" *ngIf="value">
      {{ value | currency }}</span
    >
    <span class="is-nowrap" *ngIf="!value"> - </span>`,
  styleUrls: ['./currency-yield.component.scss']
})
export class CurrencyYieldComponent {
  @Input() value: number
  // @Input() options: CurrencyPropertyOptions
}
