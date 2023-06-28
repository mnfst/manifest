import { Component, EventEmitter, Input, Output } from '@angular/core'
import { PropertyDescription } from '~shared/interfaces/property-description.interface'

@Component({
  selector: 'app-currency-input',
  template: ` <label [for]="prop.propName">{{ prop.label }}</label>
    <p class="control has-icons-right">
      <input
        class="input"
        type="number"
        step="0.01"
        (change)="onChange($event)"
      />
      <span class="icon is-small is-right">
        <i class="icon icon-dollar-sign"></i>
      </span>
    </p>`,
  styleUrls: ['./currency-input.component.scss']
})
export class CurrencyInputComponent {
  @Input() prop: PropertyDescription
  @Output() valueChanged: EventEmitter<number> = new EventEmitter()

  @Input() value: string

  onChange(event: any) {
    this.valueChanged.emit(event.target.value)
  }
}
