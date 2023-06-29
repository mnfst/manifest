import { Component, Input } from '@angular/core'

@Component({
  selector: 'app-currency-yield',
  template: `<span *ngIf="value"> {{ value }} € </span>
    <span *ngIf="!value"> - </span>`,
  styleUrls: ['./currency-yield.component.scss']
})
export class CurrencyYieldComponent {
  @Input() value: number
}
