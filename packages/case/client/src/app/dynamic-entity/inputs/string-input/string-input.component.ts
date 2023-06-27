import { Component, EventEmitter, Input, Output } from '@angular/core'
import { PropertyDescription } from '~shared/interfaces/property-description.interface'

@Component({
  selector: 'app-string-input',
  template: `<input
    class="input form-control"
    type="string"
    (change)="onChange($event)"
  />`,
  styleUrls: ['./string-input.component.scss']
})
export class StringInputComponent {
  @Input() prop: PropertyDescription
  @Output() valueChanged: EventEmitter<number> = new EventEmitter()

  onChange(event: any) {
    this.valueChanged.emit(event.target.value)
  }
}
