import { CommonModule } from '@angular/common'
import { Component, EventEmitter, Input, Output } from '@angular/core'
import { PropType, PropertyManifest } from '@manifest-yml/types'

import { MultiSelectInputComponent } from '../inputs/multi-select-input/multi-select-input.component'

@Component({
  selector: 'app-filter',
  standalone: true,
  imports: [MultiSelectInputComponent, CommonModule],
  template: ` <app-multi-select-input
    [prop]="prop"
    [value]="value"
    (valueChanged)="onChange($event)"
  >
  </app-multi-select-input>`
})
export class FilterComponent {
  @Input() prop: PropertyManifest
  @Input() value: any
  @Output() valueChanged: EventEmitter<any> = new EventEmitter()

  PropType = PropType

  onChange(event: any) {
    this.valueChanged.emit(event)
  }
}
