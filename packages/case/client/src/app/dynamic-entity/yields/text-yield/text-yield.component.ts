import { Component, Input } from '@angular/core'

@Component({
  selector: 'app-text-yield',
  template: `{{ value | truncate : ['30'] }}`,
  styleUrls: ['./text-yield.component.scss']
})
export class TextYieldComponent {
  @Input() value: string
}
