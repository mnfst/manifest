import { CommonModule } from '@angular/common'
import { Component, EventEmitter, Input, Output } from '@angular/core'
import { PropType } from '@casejs/types'
import { PropertyDescription } from '~shared/interfaces/property-description.interface'

import { MultiSelectInputComponent } from '../inputs/multi-select-input/multi-select-input.component'

@Component({
  selector: 'app-filter',
  standalone: true,
  imports: [MultiSelectInputComponent, CommonModule],
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
    this.valueChanged.emit(event)
  }
}
