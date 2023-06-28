import { Component, EventEmitter, Input, Output } from '@angular/core'
import { PropType } from '~shared/enums/prop-type.enum'
import { PropertyDescription } from '~shared/interfaces/property-description.interface'

@Component({
  selector: 'app-input',
  template: `
    <app-number-input
      [prop]="prop"
      [value]="value"
      (valueChanged)="onChange($event)"
      *ngIf="prop.type === PropType.Number"
    ></app-number-input>
    <app-text-input
      [prop]="prop"
      (valueChanged)="onChange($event)"
      *ngIf="prop.type === PropType.String"
    ></app-text-input>
    <app-select-input
      [prop]="prop"
      (valueChanged)="onChange($event)"
      *ngIf="prop.type === PropType.Relation"
    >
    </app-select-input>
  `
})
export class InputComponent {
  @Input() prop: PropertyDescription
  @Input() value: any
  @Output() valueChanged: EventEmitter<any> = new EventEmitter()

  PropType = PropType

  // TODO: Manage EDIT views and finish Select Input for relations.

  onChange(event: any) {
    this.valueChanged.emit(event)
  }
}
