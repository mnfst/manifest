import { Component, EventEmitter, Input, Output } from '@angular/core'
import { PropType } from '~shared/enums/prop-type.enum'
import { PropertyDescription } from '~shared/interfaces/property-description.interface'

@Component({
  selector: 'app-filter',
  template: ` <app-multi-select-input
    [prop]="prop"
    [value]="value"
    (valueChanged)="onChange($event)"
    *ngIf="prop.type === PropType.Relation"
  >
  </app-multi-select-input>`
})
export class FilterComponent {
  @Input() prop: PropertyDescription
  @Input() value: any
  @Output() valueChanged: EventEmitter<any> = new EventEmitter()

  PropType = PropType

  onChange(event: any) {
    console.log('event', event)
    this.valueChanged.emit(event)
  }
}
