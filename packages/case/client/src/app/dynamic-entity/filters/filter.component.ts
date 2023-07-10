import { Component, Input } from '@angular/core'
import { PropertyDescription } from '../../../../../shared/interfaces/property-description.interface'

@Component({
  selector: 'app-filter',
  template: '<-- filter -->'
})
export class FilterComponent {
  @Input() prop: PropertyDescription
}
