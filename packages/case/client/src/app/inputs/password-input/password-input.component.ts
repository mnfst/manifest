import { Component, EventEmitter, Input, Output } from '@angular/core'
import { PropertyDescription } from '~shared/interfaces/property-description.interface'

@Component({
  selector: 'app-password-input',
  standalone: true,
  template: `<label [for]="prop.propName">{{ prop.label }}</label>
    <input
      class="input form-control"
      type="password"
      (change)="onChange($event)"
    />`,
  styleUrls: ['./password-input.component.scss']
})
export class PasswordInputComponent {
  @Input() prop: PropertyDescription

  @Output() valueChanged: EventEmitter<number> = new EventEmitter()

  onChange(event: any) {
    this.valueChanged.emit(event.target.value)
  }
}
