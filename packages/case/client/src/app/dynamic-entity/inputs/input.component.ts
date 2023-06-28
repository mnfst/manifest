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
    <app-string-input
      [prop]="prop"
      [value]="value"
      (valueChanged)="onChange($event)"
      *ngIf="prop.type === PropType.Text"
    ></app-string-input>
    <app-text-input
      [prop]="prop"
      [value]="value"
      (valueChanged)="onChange($event)"
      *ngIf="prop.type === PropType.TextArea"
    ></app-text-input>
    <app-select-input
      [prop]="prop"
      [value]="value"
      (valueChanged)="onChange($event)"
      *ngIf="prop.type === PropType.Relation"
    >
    </app-select-input>
    <app-currency-input
      [prop]="prop"
      [value]="value"
      (valueChanged)="onChange($event)"
      *ngIf="prop.type === PropType.Currency"
    >
    </app-currency-input>
    <app-boolean-input
      [prop]="prop"
      [value]="value"
      (valueChanged)="onChange($event)"
      *ngIf="prop.type === PropType.Boolean"
    >
    </app-boolean-input>
  `
})
export class InputComponent {
  @Input() prop: PropertyDescription
  @Input() value: any
  @Output() valueChanged: EventEmitter<any> = new EventEmitter()

  PropType = PropType

  onChange(event: any) {
    this.valueChanged.emit(event)
  }
}
