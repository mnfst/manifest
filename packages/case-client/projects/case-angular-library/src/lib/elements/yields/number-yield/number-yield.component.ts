import { Component, Input } from '@angular/core'

@Component({
  selector: 'case-number-yield',
  template: `{{ value | number }}`
})
export class NumberYieldComponent {
  @Input() value: number
}
