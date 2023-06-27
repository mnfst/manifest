import { Component, EventEmitter, Input, Output } from '@angular/core'
import { PropertyDescription } from '~shared/interfaces/property-description.interface'

@Component({
  selector: 'app-boolean-input',
  template: `
    <input
      type="checkbox"
      [id]="prop.propName"
      class="input form-control"
      checked
    />
    <label [for]="prop.propName">{{ prop.propName }}</label>
  `,
  styleUrls: ['./boolean-input.component.scss']
})
export class BooleanInputComponent {
  @Input() prop: PropertyDescription
  @Output() valueChanged: EventEmitter<number> = new EventEmitter()

  onChange(event: any) {
    this.valueChanged.emit(event.target.value)
  }
}
