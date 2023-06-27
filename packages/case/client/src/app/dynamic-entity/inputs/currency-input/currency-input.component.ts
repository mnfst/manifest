import { Component, EventEmitter, Input, Output } from '@angular/core'
import { PropertyDescription } from '~shared/interfaces/property-description.interface'

@Component({
  selector: 'app-currency-input',
  template: `<input
    class="input form-control"
    type="number"
    (change)="onChange($event)"
  />`,
  styleUrls: ['./currency-input.component.scss']
})
export class CurrencyInputComponent {
  @Input() prop: PropertyDescription
  @Output() valueChanged: EventEmitter<number> = new EventEmitter()

  onChange(event: any) {
    this.valueChanged.emit(event.target.value)
  }
}
