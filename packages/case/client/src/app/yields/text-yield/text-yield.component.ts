import { Component, Input } from '@angular/core'

@Component({
  selector: 'app-text-yield',
  standalone: true,
  template: `{{ value }}`,
  styleUrls: ['./text-yield.component.scss']
})
export class TextYieldComponent {
  @Input() value: string
}
