import { Component, Input } from '@angular/core'

@Component({
  selector: 'app-currency-yield',
  template: `<span class="is-nowrap" *ngIf="value"> {{ value }} € </span>
    <span class="is-nowrap" *ngIf="!value"> - </span>`,
  styleUrls: ['./currency-yield.component.scss']
})
export class CurrencyYieldComponent {
  @Input() value: number
}
